import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { refundPayment } from '@/lib/payments'

type AppointmentRecord = {
  id: string
  customer_id: string | null
  status: string
  starts_at: string
  deposit_cents: number | null
}

type AppointmentTotals = {
  paid_cents: number | null
}

type PaymentRecord = {
  id: string
  provider_payment_id: string
  amount_cents: number
  status: string
}

const supabaseAdmin = getSupabaseAdmin()

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await context.params
  const LIM_H = Number(process.env.DEFAULT_REMARCA_HOURS || 24)

  const { data: appt } = await supabaseAdmin
    .from('appointments')
    .select('id, customer_id, status, starts_at, deposit_cents')
    .eq('id', id)
    .single<AppointmentRecord>()

  if (!appt || !appt.customer_id || appt.customer_id !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const starts = new Date(appt.starts_at).getTime()
  const now = Date.now()
  const withinPenalty = (starts - now) / 3600000 < LIM_H
  const deposit = appt.deposit_cents ?? 0

  const { data: tot } = await supabaseAdmin
    .from('appointment_payment_totals')
    .select('paid_cents')
    .eq('appointment_id', id)
    .maybeSingle<AppointmentTotals>()
  const paid = tot?.paid_cents ?? 0

  let refund = paid
  if (withinPenalty) refund = Math.max(paid - deposit, 0)

  if (refund > 0) {
    const { data: pays } = await supabaseAdmin
      .from('payments')
      .select('id, provider_payment_id, amount_cents, status')
      .eq('appointment_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .returns<PaymentRecord[]>()

    let remaining = refund
    for (const p of pays ?? []) {
      if (remaining <= 0) break
      const amount = Math.min(remaining, p.amount_cents)
      try {
        await refundPayment(p.provider_payment_id, amount)
      } catch {}
      remaining -= amount
    }
  }

  await supabaseAdmin
    .from('appointments')
    .update<Partial<AppointmentRecord>>({ status: 'canceled' })
    .eq('id', id)

  return NextResponse.json({ ok: true, refunded_cents: refund })
}
