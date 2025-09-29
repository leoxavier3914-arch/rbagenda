import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { createPreference, getPayment } from '@/lib/payments'
import { z } from 'zod'

const supabaseAdmin = getSupabaseAdmin()

const Body = z.object({
  appointment_id: z.string(),
  mode: z.enum(['deposit', 'balance', 'full']),
})

function parseCents(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) {
      return value
    }
    return Math.round(value * 100)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const normalized = trimmed.replace(',', '.')
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) return null
    if (normalized.includes('.')) {
      return Math.round(parsed * 100)
    }
    return Math.round(parsed)
  }

  return null
}

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

  const totalCents = parseCents(appt.total_cents)
  if (totalCents === null || !Number.isFinite(totalCents) || totalCents <= 0) {
    return NextResponse.json({ error: 'Total inválido para o agendamento' }, { status: 400 })
  }

  const depositCents = parseCents(appt.deposit_cents)

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
  const paid = parseCents(tot?.paid_cents) ?? 0

  let amount = 0
  let title = 'Pagamento'
  let coversDeposit = false
  if (mode === 'deposit') {
    if (depositCents === null || depositCents <= 0 || !Number.isFinite(depositCents)) {
      return NextResponse.json({ error: 'Sinal não configurado para este agendamento' }, { status: 400 })
    }
    amount = depositCents
    title = 'Sinal'
    coversDeposit = true
  } else if (mode === 'balance') {
    amount = Math.max(totalCents - Math.max(0, paid), 0)
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

  const nowIso = new Date().toISOString()
  const requestUrl = new URL(req.url)
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    `${requestUrl.protocol}//${requestUrl.host}`

  const { data: existingPayment } = await supabaseAdmin
    .from('payments')
    .select('id, provider_payment_id, amount_cents')
    .eq('appointment_id', appointment_id)
    .eq('provider', 'stripe')
    .eq('kind', mode)
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (existingPayment?.provider_payment_id && existingPayment.amount_cents === amount) {
    const intent = await getPayment(existingPayment.provider_payment_id).catch(() => null)

    if (intent) {
      if (intent.status === 'succeeded') {
        return NextResponse.json(
          { error: 'Este pagamento já foi concluído.' },
          { status: 400 },
        )
      }

      const reusableStatuses = new Set<
        Stripe.PaymentIntent.Status
      >(['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'])

      if (reusableStatuses.has(intent.status)) {
        const clientSecret = intent.client_secret ?? null

        if (clientSecret) {
          await supabaseAdmin
            .from('payments')
            .update({ payload: intent, status: 'pending', updated_at: nowIso })
            .eq('id', existingPayment.id)

          return NextResponse.json({
            client_secret: clientSecret,
            session_id: existingPayment.provider_payment_id,
            reused: true,
          })
        }
      }
    }
  }

  const pref = await createPreference({
    title,
    amount_cents: amount,
    reference: appointment_id,
    notification_url: `${baseUrl}/api/webhooks/stripe`,
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
    payload: pref.intent,
    updated_at: nowIso,
  })

  return NextResponse.json({ client_secret: pref.client_secret, session_id: pref.id })
}
