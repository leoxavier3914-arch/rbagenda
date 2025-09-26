import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/db'
import { enqueueDefaultReminders } from '@/lib/reminders'
import type { StripeCheckoutSession, StripeCharge, StripePaymentIntent } from '@/lib/payments'
import { findSessionByPaymentIntent, getPayment } from '@/lib/payments'

const supabaseAdmin = getSupabaseAdmin()

type StripeEvent = {
  id?: string
  type?: string
  data?: { object?: unknown } | null
}

type PaymentStatus = 'pending' | 'approved' | 'failed' | 'refunded' | 'partially_refunded'

function isValidStripeSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !signatureHeader) return true

  const parts = signatureHeader.split(',').map((part) => part.trim())
  const timestampPart = parts.find((part) => part.startsWith('t='))
  const signatures = parts.filter((part) => part.startsWith('v1='))
  if (!timestampPart || signatures.length === 0) return false

  const timestamp = timestampPart.split('=')[1]
  if (!timestamp) return false

  const payload = `${timestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  for (const sigPart of signatures) {
    const candidate = sigPart.split('=')[1]
    if (!candidate) continue
    try {
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))) {
        return true
      }
    } catch {}
  }

  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getStringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null
  const field = value[key]
  return typeof field === 'string' ? field : null
}

function computeRefundStatus(charges: StripeCharge[] | undefined): PaymentStatus | null {
  if (!Array.isArray(charges) || charges.length === 0) return null
  let captured = 0
  let refunded = 0

  for (const charge of charges) {
    const amountCaptured = typeof charge.amount_captured === 'number' ? charge.amount_captured : charge.amount ?? 0
    const amountRefunded = typeof charge.amount_refunded === 'number' ? charge.amount_refunded : 0
    captured += amountCaptured
    refunded += amountRefunded
  }

  if (refunded <= 0) return null
  if (captured > 0 && refunded >= captured) return 'refunded'
  return 'partially_refunded'
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!isValidStripeSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as StripeEvent
  const eventId = event.id ?? `evt_${Date.now()}`

  try {
    await supabaseAdmin.from('webhook_events').insert({
      provider: 'stripe',
      event_id: eventId,
      payload: event,
    })
  } catch (error) {
    console.error('Erro ao registrar webhook Stripe', error)
  }

  const object = event.data?.object
  const objectType = getStringField(object, 'object')
  let sessionId: string | null = null
  let appointmentId: string | null = null

  if (objectType === 'checkout.session') {
    sessionId = getStringField(object, 'id')
    const metadataValue = isRecord(object) ? object['metadata'] : null
    appointmentId = getStringField(metadataValue, 'appointment_id')
  } else if (objectType === 'payment_intent') {
    const paymentIntentId = getStringField(object, 'id')
    const metadataValue = isRecord(object) ? object['metadata'] : null
    appointmentId = getStringField(metadataValue, 'appointment_id')
    if (paymentIntentId) {
      const found = await findSessionByPaymentIntent(paymentIntentId).catch(() => null)
      if (found && typeof found.id === 'string') {
        sessionId = found.id
        const foundMetadata = isRecord(found.metadata) ? found.metadata : null
        if (!appointmentId) {
          appointmentId = getStringField(foundMetadata, 'appointment_id')
        }
      }
    }
  } else if (objectType === 'charge') {
    const paymentIntentId = getStringField(object, 'payment_intent')
    const metadataValue = isRecord(object) ? object['metadata'] : null
    appointmentId = getStringField(metadataValue, 'appointment_id')
    if (paymentIntentId) {
      const found = await findSessionByPaymentIntent(paymentIntentId).catch(() => null)
      if (found && typeof found.id === 'string') {
        sessionId = found.id
        const foundMetadata = isRecord(found.metadata) ? found.metadata : null
        if (!appointmentId) {
          appointmentId = getStringField(foundMetadata, 'appointment_id')
        }
      }
    }
  }

  if (!sessionId) {
    return NextResponse.json({ ok: true, note: 'session not found for event' })
  }

  const session = await getPayment(sessionId).catch((error) => {
    console.error('Erro ao buscar sessão Stripe', error)
    return null
  })

  if (!session) {
    return NextResponse.json({ ok: true, note: 'session lookup failed' })
  }

  const paymentIntent = session.payment_intent
  const paymentIntentObject: StripePaymentIntent | undefined =
    typeof paymentIntent === 'string' ? undefined : paymentIntent
  const charges = Array.isArray(paymentIntentObject?.charges?.data)
    ? (paymentIntentObject?.charges?.data as StripeCharge[])
    : undefined

  let newStatus: PaymentStatus | null = null

  const refundStatus = computeRefundStatus(charges)
  if (refundStatus) {
    newStatus = refundStatus
  } else if (session.payment_status === 'paid' || paymentIntentObject?.status === 'succeeded') {
    newStatus = 'approved'
  } else if (
    event.type === 'checkout.session.async_payment_failed' ||
    event.type === 'payment_intent.payment_failed' ||
    paymentIntentObject?.status === 'requires_payment_method'
  ) {
    newStatus = 'failed'
  }

  const updatePayload: { payload: StripeCheckoutSession; status?: PaymentStatus } = { payload: session }
  if (newStatus) {
    updatePayload.status = newStatus
  }

  const updateQuery = supabaseAdmin.from('payments').update(updatePayload)
  if (appointmentId) {
    updateQuery.or(`provider_payment_id.eq.${session.id},appointment_id.eq.${appointmentId}`)
  } else {
    updateQuery.eq('provider_payment_id', session.id)
  }

  await updateQuery

  if (appointmentId && newStatus === 'approved') {
    const { data: appt } = await supabaseAdmin
      .from('appointments')
      .select('id,status')
      .eq('id', appointmentId)
      .maybeSingle()

    if (appt && appt.status === 'pending') {
      await supabaseAdmin.from('appointments').update({ status: 'confirmed' }).eq('id', appt.id)
      await enqueueDefaultReminders(appt.id)
    }
  }

  return NextResponse.json({ ok: true })
}
