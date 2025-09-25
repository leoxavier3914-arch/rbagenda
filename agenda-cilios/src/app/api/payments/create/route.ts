import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { createPreference } from '@/lib/payments'
import { z } from 'zod'

const Body = z.object({
  appointment_id: z.string(),
  mode: z.enum(['deposit','balance','full'])
})

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const json = await req.json();
  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { appointment_id, mode } = parsed.data

  const { data: appt } = await supabaseAdmin.from('appointments').select('id, customer_id, total_cents, deposit_cents').eq('id', appointment_id).single()
  if (!appt || appt.customer_id !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: tot } = await supabaseAdmin.from('appointment_payment_totals').select('paid_cents').eq('appointment_id', appointment_id).maybeSingle()
  const paid = tot?.paid_cents || 0

  let amount = 0, title = 'Pagamento', coversDeposit = false
  if (mode==='deposit') { amount = appt.deposit_cents; title='Sinal' }
  else if (mode==='balance') { amount = Math.max(appt.total_cents - paid, 0); title='Saldo' }
  else { amount = appt.total_cents; title='Integral'; coversDeposit = true }

  if (amount <= 0) return NextResponse.json({ error: 'Nada a pagar' }, { status: 400 })

  const pref = await createPreference({
    title,
    amount_cents: amount,
    reference: appointment_id,
    notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/mercadopago`
  })

  await supabaseAdmin.from('payments').insert({
    appointment_id,
    provider: 'mercadopago',
    provider_payment_id: pref.id,
    kind: mode,
    covers_deposit: coversDeposit,
    status: 'pending',
    amount_cents: amount,
    payload: pref
  })

  return NextResponse.json({ checkout_url: pref.init_point || pref.sandbox_init_point || pref.point_of_interaction?.transaction_data?.ticket_url })
}
