import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/db'
import { enqueueDefaultReminders } from '@/lib/reminders'
import { getPayment } from '@/lib/payments'
import type { PagarmeCharge } from '@/lib/payments'

const supabaseAdmin = getSupabaseAdmin()

type PaymentStatus = 'pending' | 'approved' | 'failed' | 'refunded' | 'partially_refunded'

type PgEvent = {
  id?: string | number
  type?: string
  event?: string
  data?: {
    id?: string
    order?: { id?: string }
    [key: string]: unknown
  }
  order?: { id?: string }
  resource_id?: string
}

function isValidSignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAGARME_WEBHOOK_SECRET
  if (!secret || !signature) return true

  const expected = `sha1=${crypto.createHmac('sha1', secret).update(rawBody).digest('hex')}`

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature') ?? req.headers.get('x-pagarme-signature')

  if (!isValidSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as PgEvent
  const eventId = body.id ?? `evt_${Date.now()}`
  const eventType = body.event ?? body.type ?? ''
  const orderId =
    body.data?.id ?? body.data?.order?.id ?? body.order?.id ?? (typeof body.resource_id === 'string' ? body.resource_id : null)

  try {
    await supabaseAdmin.from('webhook_events').insert({
      provider: 'pagarme',
      event_id: String(eventId),
      payload: body,
    })
  } catch (error) {
    console.error('Erro ao registrar webhook do Pagar.me', error)
  }

  if (!orderId) {
    return NextResponse.json({ ok: true, note: 'sem orderId' })
  }

  const order = await getPayment(orderId).catch((error) => {
    console.error('Erro ao consultar ordem no Pagar.me', error)
    return null
  })

  if (!order) {
    return NextResponse.json({ ok: true, note: 'ordem não encontrada' })
  }

  if (typeof order.id !== 'string') {
    return NextResponse.json({ ok: true, note: 'ordem sem id' })
  }

  const metadata = order.metadata && typeof order.metadata === 'object' ? (order.metadata as Record<string, unknown>) : null
  let appointmentId: string | null = null
  if (typeof order.code === 'string' && order.code) {
    appointmentId = order.code
  } else if (metadata) {
    const metaAppointment = metadata['appointment_id']
    if (typeof metaAppointment === 'string') {
      appointmentId = metaAppointment
    }
  }

  const charges: PagarmeCharge[] = Array.isArray(order.charges) ? order.charges : []
  const paidCharge = charges.find((charge) => charge.status === 'paid' || charge.status === 'partial_paid')
  const canceledCharges = charges.filter((charge) => charge.status === 'canceled')
  const hasRefund = canceledCharges.length > 0
  const partiallyRefunded = hasRefund && canceledCharges.some((charge) => typeof charge.paid_amount === 'number' && charge.paid_amount > 0)

  let newStatus: PaymentStatus = 'pending'

  if (paidCharge) {
    newStatus = 'approved'
  }

  if (eventType.includes('payment_failed') || eventType.includes('order.canceled')) {
    newStatus = 'failed'
  }

  if (hasRefund) {
    newStatus = partiallyRefunded ? 'partially_refunded' : 'refunded'
  }

  const updateQuery = supabaseAdmin.from('payments').update({ status: newStatus, payload: order })
  if (appointmentId) {
    updateQuery.or(`provider_payment_id.eq.${order.id},appointment_id.eq.${appointmentId}`)
  } else {
    updateQuery.eq('provider_payment_id', order.id)
  }
  await updateQuery

  if (appointmentId && newStatus === 'approved') {
    const { data: appt } = await supabaseAdmin
      .from('appointments')
      .select('id, status')
      .eq('id', appointmentId)
      .maybeSingle()

    if (appt && appt.status === 'pending') {
      await supabaseAdmin.from('appointments').update({ status: 'confirmed' }).eq('id', appt.id)
      await enqueueDefaultReminders(appt.id)
    }
  }

  return NextResponse.json({ ok: true })
}
