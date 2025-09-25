import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { getPayment } from '@/lib/payments'
import { enqueueDefaultReminders } from '@/lib/reminders'

export async function POST(req: NextRequest) {
  const rawBody = await req.json().catch(() => ({}))
  const body = rawBody as Record<string, unknown>
  const bodyData = body.data as { id?: string } | undefined
  const bodyId = body.id as string | number | undefined
  const action = body.action as string | undefined
  const resource = body.resource as string | undefined

  const { searchParams } = new URL(req.url)
  const qType = searchParams.get('type')
  const qId = searchParams.get('id')
  const eventId = String(bodyId ?? action ?? bodyData?.id ?? resource ?? qId ?? `evt_${Date.now()}`)

  try {
    await supabaseAdmin.from('webhook_events').insert({ provider: 'mercadopago', event_id: eventId, payload: body })
  } catch {}

  const paymentId = bodyData?.id ?? (qType === 'payment' ? qId : null)
  if (!paymentId) return NextResponse.json({ ok: true, note: 'no payment id' })

  const pay = await getPayment(paymentId)
  const appointmentId = pay?.external_reference

  if (pay?.status === 'approved') {
    await supabaseAdmin.from('payments').update({ status: 'approved', payload: pay }).or(`provider_payment_id.eq.${pay.id}, appointment_id.eq.${appointmentId}`)

    if (appointmentId) {
      const { data: appt } = await supabaseAdmin.from('appointments').select('id,status').eq('id', appointmentId).maybeSingle()
      if (appt && appt.status === 'pending') {
        await supabaseAdmin.from('appointments').update({ status: 'confirmed' }).eq('id', appt.id)
        await enqueueDefaultReminders(appt.id)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
