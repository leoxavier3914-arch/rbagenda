import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/db'
import { enqueueDefaultReminders } from '@/lib/reminders'
import { getPayment, getStripeClient } from '@/lib/payments'

const supabaseAdmin = getSupabaseAdmin()

type PaymentStatus = 'pending' | 'approved' | 'failed' | 'refunded' | 'partially_refunded'

function getAppointmentIdFromSession(session: Stripe.Checkout.Session): string | null {
  const metaAppointment = session.metadata?.appointment_id
  if (typeof metaAppointment === 'string' && metaAppointment) {
    return metaAppointment
  }
  if (typeof session.client_reference_id === 'string' && session.client_reference_id) {
    return session.client_reference_id
  }
  return null
}

function getAppointmentIdFromPaymentIntent(intent: Stripe.PaymentIntent): string | null {
  const metaAppointment = intent.metadata?.appointment_id
  return typeof metaAppointment === 'string' && metaAppointment ? metaAppointment : null
}

async function findSessionByPaymentIntent(stripe: Stripe, paymentIntentId: string) {
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 })
    return sessions.data[0] ?? null
  } catch (error) {
    console.error('Erro ao localizar sessão do Stripe para o PaymentIntent', error)
    return null
  }
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

  let session: Stripe.Checkout.Session | null = null
  let sessionId: string | null = null
  let appointmentId: string | null = null
  let newStatus: PaymentStatus | null = null

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      session = event.data.object as Stripe.Checkout.Session
      sessionId = session.id
      appointmentId = getAppointmentIdFromSession(session)
      newStatus = 'approved'
      break
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired':
      session = event.data.object as Stripe.Checkout.Session
      sessionId = session.id
      appointmentId = getAppointmentIdFromSession(session)
      newStatus = 'failed'
      break
    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled': {
      const intent = event.data.object as Stripe.PaymentIntent
      appointmentId = getAppointmentIdFromPaymentIntent(intent)
      session = await findSessionByPaymentIntent(stripe, intent.id)
      sessionId = session?.id ?? null
      if (!appointmentId && session) {
        appointmentId = getAppointmentIdFromSession(session)
      }
      newStatus = 'failed'
      break
    }
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent
      appointmentId = getAppointmentIdFromPaymentIntent(intent)
      session = await findSessionByPaymentIntent(stripe, intent.id)
      sessionId = session?.id ?? null
      if (!appointmentId && session) {
        appointmentId = getAppointmentIdFromSession(session)
      }
      newStatus = 'approved'
      break
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      const paymentIntent = charge.payment_intent
      const paymentIntentId =
        typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id ?? null
      if (paymentIntentId) {
        session = await findSessionByPaymentIntent(stripe, paymentIntentId)
        sessionId = session?.id ?? null
        if (session && !appointmentId) {
          appointmentId = getAppointmentIdFromSession(session)
        }
      }
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
      break
    }
    default:
      return NextResponse.json({ ok: true, ignored: event.type })
  }

  if (!newStatus) {
    return NextResponse.json({ ok: true, ignored: event.type })
  }

  if (!session && sessionId) {
    session = await getPayment(sessionId).catch((error) => {
      console.error('Erro ao consultar sessão do Stripe', error)
      return null
    })
  }

  const payload = session ?? event.data.object

  if (!sessionId && !appointmentId) {
    return NextResponse.json({ ok: true, note: 'sem identificadores' })
  }

  const updateQuery = supabaseAdmin.from('payments').update({ status: newStatus, payload })
  if (sessionId && appointmentId) {
    updateQuery.or(`provider_payment_id.eq.${sessionId},appointment_id.eq.${appointmentId}`)
  } else if (sessionId) {
    updateQuery.eq('provider_payment_id', sessionId)
  } else if (appointmentId) {
    updateQuery.eq('appointment_id', appointmentId)
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
