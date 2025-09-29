import { getSupabaseAdmin } from './db'

const supabaseAdmin = getSupabaseAdmin()

type PendingAppointment = {
  id: string
  deposit_cents: number | string | null
}

type PaymentTotal = {
  appointment_id: string
  paid_cents: number | string | null
}

export async function finalizePastAppointments(graceHours = 3) {
  const threshold = new Date(Date.now() - graceHours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .update({ status: 'completed' })
    .lte('starts_at', threshold)
    .in('status', ['pending', 'reserved', 'confirmed'])
    .select('id')

  if (error) {
    throw error
  }

  return data?.length ?? 0
}

export async function cancelExpiredPendingAppointments(
  graceHours = 2,
  batchSize = 200,
) {
  const threshold = new Date(Date.now() - graceHours * 60 * 60 * 1000).toISOString()

  const { data: appts, error } = await supabaseAdmin
    .from('appointments')
    .select('id, deposit_cents')
    .eq('status', 'pending')
    .gt('deposit_cents', 0)
    .lte('created_at', threshold)
    .order('created_at', { ascending: true })
    .limit(batchSize)
    .returns<PendingAppointment[]>()

  if (error) {
    throw error
  }

  if (!appts?.length) return 0

  const ids = appts.map((appt) => appt.id)

  const { data: totals, error: totalsError } = await supabaseAdmin
    .from('appointment_payment_totals')
    .select('appointment_id, paid_cents')
    .in('appointment_id', ids)
    .returns<PaymentTotal[]>()

  if (totalsError) {
    throw totalsError
  }

  const totalsMap = new Map<string, number>()
  for (const tot of totals ?? []) {
    const paid =
      typeof tot.paid_cents === 'number'
        ? tot.paid_cents
        : tot.paid_cents
        ? Number(tot.paid_cents)
        : 0
    if (!Number.isNaN(paid)) {
      totalsMap.set(tot.appointment_id, paid)
    }
  }

  const toCancel = appts.filter((appt) => {
    const deposit =
      typeof appt.deposit_cents === 'number'
        ? appt.deposit_cents
        : appt.deposit_cents
        ? Number(appt.deposit_cents)
        : 0
    if (!Number.isFinite(deposit) || deposit <= 0) return false
    const paid = totalsMap.get(appt.id) ?? 0
    return paid < deposit
  })

  if (!toCancel.length) return 0

  const { error: cancelError } = await supabaseAdmin
    .from('appointments')
    .update({ status: 'canceled' })
    .in('id', toCancel.map((appt) => appt.id))

  if (cancelError) {
    throw cancelError
  }

  return toCancel.length
}
