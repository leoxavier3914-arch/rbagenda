import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { createPreference } from '@/lib/payments'
import { z } from 'zod'

const supabaseAdmin = getSupabaseAdmin()

const Body = z.object({
  appointment_id: z.string(),
  mode: z.enum(['deposit', 'balance', 'full']),
})

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const json = await req.json()
  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { appointment_id, mode } = parsed.data

  const { data: appt } = await supabaseAdmin
    .from('appointments')
    .select('id, customer_id, total_cents, deposit_cents')
    .eq('id', appointment_id)
    .single()
  if (!appt || appt.customer_id !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const totalCentsRaw = appt.total_cents
  const totalCents =
    typeof totalCentsRaw === 'number'
      ? totalCentsRaw
      : totalCentsRaw
      ? Number(totalCentsRaw)
      : null

  const depositCentsRaw = appt.deposit_cents
  const depositCents =
    typeof depositCentsRaw === 'number'
      ? depositCentsRaw
      : depositCentsRaw
      ? Number(depositCentsRaw)
      : null

  if (totalCents === null || Number.isNaN(totalCents)) {
    return NextResponse.json({ error: 'Total inválido para o agendamento' }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email, whatsapp')
    .eq('id', user.id)
    .maybeSingle()

  const { data: tot } = await supabaseAdmin
    .from('appointment_payment_totals')
    .select('paid_cents')
    .eq('appointment_id', appointment_id)
    .maybeSingle()
  const paidRaw = tot?.paid_cents
  const paid =
    typeof paidRaw === 'number'
      ? paidRaw
      : paidRaw
      ? Number(paidRaw)
      : 0

  if (Number.isNaN(paid)) {
    return NextResponse.json({ error: 'Total pago inválido' }, { status: 500 })
  }

  let amount = 0
  let title = 'Pagamento'
  let coversDeposit = false
  if (mode === 'deposit') {
    if (depositCents === null || depositCents <= 0 || Number.isNaN(depositCents)) {
      return NextResponse.json({ error: 'Sinal não configurado para este agendamento' }, { status: 400 })
    }
    amount = depositCents
    title = 'Sinal'
  } else if (mode === 'balance') {
    amount = Math.max(totalCents - paid, 0)
    title = 'Saldo'
  } else {
    amount = totalCents
    title = 'Integral'
    coversDeposit = true
  }

  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return NextResponse.json({ error: 'Valor inválido calculado para o pagamento' }, { status: 400 })
  }

  if (amount <= 0) return NextResponse.json({ error: 'Nada a pagar' }, { status: 400 })

  const pref = await createPreference({
    title,
    amount_cents: amount,
    reference: appointment_id,
    notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/stripe`,
    mode,
    customer: {
      name: profile?.full_name ?? undefined,
      email: profile?.email ?? undefined,
      phone: profile?.whatsapp ?? undefined,
    },
  })

  if (!pref.client_secret) {
    return NextResponse.json({ error: 'Falha ao gerar checkout do Stripe' }, { status: 502 })
  }

  await supabaseAdmin.from('payments').insert({
    appointment_id,
    provider: 'stripe',
    provider_payment_id: pref.id,
    kind: mode,
    covers_deposit: coversDeposit,
    status: 'pending',
    amount_cents: amount,
    payload: pref.session,
  })

  return NextResponse.json({ client_secret: pref.client_secret, session_id: pref.id })
}
