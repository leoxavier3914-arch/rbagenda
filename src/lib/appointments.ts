import { getSupabaseAdmin } from './db'

const supabaseAdmin = getSupabaseAdmin()

export type PendingAppointment = {
  id: string
  deposit_cents: number | string | null
  valor_sinal: number | string | null
}

export type PaymentTotal = {
  appointment_id: string
  paid_cents: number | string | null
}

const parseNumber = (value: number | string | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const resolveDepositCents = (
  depositCents: number | string | null,
  valorSinal: number | string | null,
) => {
  const parsedDeposit = parseNumber(depositCents)
  if (parsedDeposit !== null) {
    const rounded = Math.round(parsedDeposit)
    if (Number.isFinite(rounded) && rounded > 0) {
      return rounded
    }
  }

  const parsedValor = parseNumber(valorSinal)
  if (parsedValor !== null) {
    const cents = Math.round(parsedValor * 100)
    if (Number.isFinite(cents) && cents > 0) {
      return cents
    }
  }

  return 0
}

export function determinePendingAppointmentsToCancel(
  appointments: PendingAppointment[],
  totals: PaymentTotal[],
) {
  if (!appointments.length) return [] as PendingAppointment[]

  const totalsMap = new Map<string, number>()
  for (const tot of totals ?? []) {
    const paid = parseNumber(tot.paid_cents)
    if (paid !== null && Number.isFinite(paid)) {
      totalsMap.set(tot.appointment_id, Math.max(0, Math.round(paid)))
    }
  }

  return appointments.filter((appt) => {
    const deposit = resolveDepositCents(appt.deposit_cents, appt.valor_sinal)
    if (!Number.isFinite(deposit) || deposit <= 0) {
      return true
    }

    const paid = totalsMap.get(appt.id) ?? 0
    return paid < deposit
  })
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
    .select('id, deposit_cents, valor_sinal')
    .eq('status', 'pending')
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

  const toCancel = determinePendingAppointmentsToCancel(appts, totals ?? [])

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
