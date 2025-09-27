import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/db'
import { enqueueDefaultReminders } from '@/lib/reminders'
import { getPayment, getStripeClient } from '@/lib/payments'

const supabaseAdmin = getSupabaseAdmin()

type PaymentStatus = 'pending' | 'approved' | 'failed' | 'refunded' | 'partially_refunded'

function getAppointmentIdFromPaymentIntent(intent: Stripe.PaymentIntent): string | null {
  const metaAppointment = intent.metadata?.appointment_id
  return typeof metaAppointment === 'string' && metaAppointment ? metaAppointment : null
}

export async function POST(req: NextRequest) {
  const stripe = getStripeClient()
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event: Stripe.Event

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(Buffer.from(rawBody), signature, webhookSecret)
    } else {
      event = JSON.parse(rawBody) as Stripe.Event
    }
  } catch (error) {
    console.error('Erro ao validar webhook do Stripe', error)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  try {
    await supabaseAdmin.from('webhook_events').insert({
      provider: 'stripe',
      event_id: String(event.id ?? `evt_${Date.now()}`),
      payload: event,
    })
  } catch (error) {
    console.error('Erro ao registrar webhook do Stripe', error)
  }

  let intent: Stripe.PaymentIntent | null = null
  let paymentIntentId: string | null = null
  let appointmentId: string | null = null
  let newStatus: PaymentStatus | null = null
  let payload: Stripe.PaymentIntent | Stripe.Charge | null = null
  let paymentRecord:
    | {
        id: string
        appointment_id: string
        kind: 'deposit' | 'balance' | 'full'
      }
    | null = null

  switch (event.type) {
    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled': {
      const intent = event.data.object as Stripe.PaymentIntent
      appointmentId = getAppointmentIdFromPaymentIntent(intent)
      paymentIntentId = intent.id
      payload = intent
      newStatus = 'failed'
      break
    }
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent
      appointmentId = getAppointmentIdFromPaymentIntent(intent)
      paymentIntentId = intent.id
      payload = intent
      newStatus = 'approved'
      break
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      const paymentIntent = charge.payment_intent
      paymentIntentId =
        typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id ?? null
      if (!appointmentId) {
        const metaAppointment = charge.metadata?.appointment_id
        if (typeof metaAppointment === 'string' && metaAppointment) {
          appointmentId = metaAppointment
        }
      }
      const refundedAmount = typeof charge.amount_refunded === 'number' ? charge.amount_refunded : 0
      const totalAmount = typeof charge.amount === 'number' ? charge.amount : 0
      if (refundedAmount > 0 && totalAmount > 0 && refundedAmount < totalAmount) {
        newStatus = 'partially_refunded'
      } else {
        newStatus = 'refunded'
      }
      payload = charge
      break
    }
    default:
      return NextResponse.json({ ok: true, ignored: event.type })
  }

  if (!newStatus) {
    return NextResponse.json({ ok: true, ignored: event.type })
  }

  if (!payload && paymentIntentId) {
    intent = await getPayment(paymentIntentId).catch((error) => {
      console.error('Erro ao consultar PaymentIntent do Stripe', error)
      return null
    })
    payload = intent
    if (!appointmentId && intent) {
      appointmentId = getAppointmentIdFromPaymentIntent(intent)
    }
  } else if (payload && 'object' in payload && payload.object === 'payment_intent') {
    intent = payload as Stripe.PaymentIntent
  }

  if (!paymentIntentId && intent) {
    paymentIntentId = intent.id
  }

  if (!paymentIntentId && !appointmentId) {
    return NextResponse.json({ ok: true, note: 'sem identificadores' })
  }

  if (paymentIntentId) {
    const { data: record } = await supabaseAdmin
      .from('payments')
      .select('id, appointment_id, kind')
      .eq('provider_payment_id', paymentIntentId)
      .maybeSingle()
    if (record) {
      paymentRecord = record
      if (!appointmentId) {
        appointmentId = record.appointment_id
      }
    }
  }

  if (!paymentRecord && appointmentId) {
    const { data: record } = await supabaseAdmin
      .from('payments')
      .select('id, appointment_id, kind')
      .eq('appointment_id', appointmentId)
      .eq('provider', 'stripe')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (record) {
      paymentRecord = record
    }
  }

  const updateQuery = supabaseAdmin
    .from('payments')
    .update({ status: newStatus, payload, updated_at: new Date().toISOString() })
  if (paymentIntentId && appointmentId) {
    updateQuery.or(`provider_payment_id.eq.${paymentIntentId},appointment_id.eq.${appointmentId}`)
  } else if (paymentIntentId) {
    updateQuery.eq('provider_payment_id', paymentIntentId)
  } else if (appointmentId) {
    updateQuery.eq('appointment_id', appointmentId)
  }
  await updateQuery

  if (appointmentId && newStatus === 'approved') {
    const { data: appt } = await supabaseAdmin
      .from('appointments')
      .select('id, status, paid_in_full')
      .eq('id', appointmentId)
      .maybeSingle()

    if (appt) {
      let nextStatus: 'reserved' | 'confirmed' | null = null
      let shouldEnqueueReminders = false

      if (appt.status === 'pending') {
        if (paymentRecord?.kind === 'deposit') {
          nextStatus = 'reserved'
          shouldEnqueueReminders = true
        } else if (appt.paid_in_full) {
          nextStatus = 'confirmed'
          shouldEnqueueReminders = true
        }
      } else if (appt.status === 'reserved' && appt.paid_in_full) {
        nextStatus = 'confirmed'
      }

      if (nextStatus && nextStatus !== appt.status) {
        await supabaseAdmin.from('appointments').update({ status: nextStatus }).eq('id', appt.id)
        if (shouldEnqueueReminders) {
          await enqueueDefaultReminders(appt.id)
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
