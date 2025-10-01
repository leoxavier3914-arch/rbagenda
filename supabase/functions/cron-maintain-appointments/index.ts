declare const Deno: {
  env: { get(key: string): string | undefined }
  serve: (handler: (request: Request) => Response | Promise<Response>) => void
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable')
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
}

// @ts-expect-error: Remote import resolved at runtime by the Deno edge runtime
const { createClient } = (await import(
  'https://esm.sh/@supabase/supabase-js@2.45.0'
)) as typeof import('https://esm.sh/@supabase/supabase-js@2.45.0')

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

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

function determinePendingAppointmentsToCancel(
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

async function finalizePastAppointments(graceHours = 3) {
  const threshold = new Date(Date.now() - graceHours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
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

async function cancelExpiredPendingAppointments(
  graceHours = 2,
  batchSize = 200,
) {
  const threshold = new Date(Date.now() - graceHours * 60 * 60 * 1000).toISOString()

  const { data: appts, error } = await supabase
    .from('appointments')
    .select('id, deposit_cents, valor_sinal')
    .eq('status', 'pending')
    .lte('created_at', threshold)
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (error) {
    throw error
  }

  if (!appts?.length) return 0

  const pendingAppointments = (appts ?? []) as PendingAppointment[]

  const ids = pendingAppointments.map((appt) => appt.id)

  const { data: totals, error: totalsError } = await supabase
    .from('appointment_payment_totals')
    .select('appointment_id, paid_cents')
    .in('appointment_id', ids)

  if (totalsError) {
    throw totalsError
  }

  const paymentTotals = (totals ?? []) as PaymentTotal[]

  const toCancel = determinePendingAppointmentsToCancel(pendingAppointments, paymentTotals)

  if (!toCancel.length) return 0

  const { error: cancelError } = await supabase
    .from('appointments')
    .update({ status: 'canceled' })
    .in('id', toCancel.map((appt) => appt.id))

  if (cancelError) {
    throw cancelError
  }

  return toCancel.length
}

Deno.serve(async () => {
  try {
    const [completedCount, canceledCount] = await Promise.all([
      finalizePastAppointments(),
      cancelExpiredPendingAppointments(),
    ])

    return new Response(
      JSON.stringify({ completedCount, canceledCount }),
      {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    )
  } catch (error) {
    console.error('cron-maintain-appointments error', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    )
  }
})
