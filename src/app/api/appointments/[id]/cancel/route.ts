import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { refundPayment } from '@/lib/payments'

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
    .eq('id', id).single()

  if (!appt || (appt.customer_id !== user.id)) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const starts = new Date(appt.starts_at).getTime();
  const now = Date.now()
  const withinPenalty = (starts - now) / 3600000 < LIM_H

  const { data: tot } = await supabaseAdmin
    .from('appointment_payment_totals').select('paid_cents')
    .eq('appointment_id', id).maybeSingle()
  const paid = tot?.paid_cents || 0

  let refund = paid
  if (withinPenalty) refund = Math.max(paid - appt.deposit_cents, 0)

  if (refund > 0) {
    const { data: pays } = await supabaseAdmin
      .from('payments')
      .select('id, provider_payment_id, amount_cents, status')
      .eq('appointment_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })

    let remaining = refund
    for (const p of (pays||[])) {
      if (remaining<=0) break
      const amt = Math.min(remaining, p.amount_cents)
      try {
        await refundPayment(p.provider_payment_id, amt)
      } catch {}
      remaining -= amt
    }
  }

  await supabaseAdmin.from('appointments').update({ status: 'canceled' }).eq('id', id)

  return NextResponse.json({ ok: true, refunded_cents: refund })
}
