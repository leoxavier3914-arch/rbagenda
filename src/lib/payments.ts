const STRIPE_BASE = process.env.STRIPE_API_URL ?? 'https://api.stripe.com/v1'
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY

if (!STRIPE_SECRET) {
  throw new Error('Defina STRIPE_SECRET_KEY no ambiente')
}

function buildHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${STRIPE_SECRET}`)

  if (init?.body instanceof URLSearchParams) {
    headers.set('Content-Type', 'application/x-www-form-urlencoded')
  } else if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  headers.set('Stripe-Version', process.env.STRIPE_API_VERSION ?? '2024-06-20')

  return headers
}

type StripeJson = Record<string, unknown>

export type StripeCharge = StripeJson & {
  amount_captured?: number
  amount?: number
  amount_refunded?: number
}

export type StripePaymentIntent = StripeJson & {
  id?: string
  status?: string
  charges?: { data?: StripeCharge[] }
}

export type StripeCheckoutSession = StripeJson & {
  id?: string
  url?: string | null
  metadata?: Record<string, unknown>
  payment_status?: string
  payment_intent?: string | StripePaymentIntent
}

async function stripeFetch(path: string, init?: RequestInit): Promise<StripeJson> {
  const res = await fetch(`${STRIPE_BASE}${path}`, {
    ...init,
    headers: buildHeaders(init),
    cache: 'no-store',
  })

  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText)
    throw new Error(`Stripe ${res.status}: ${message}`)
  }

  return (await res.json()) as StripeJson
}

type CreatePreferenceInput = {
  title: string
  amount_cents: number
  reference: string
  notification_url: string
  mode?: 'deposit' | 'balance' | 'full'
  customer?: {
    name?: string | null
    email?: string | null
    phone?: string | null
  }
}

export async function createPreference({
  title,
  amount_cents,
  reference,
  notification_url: _notificationUrl,
  mode,
  customer,
}: CreatePreferenceInput) {
  void _notificationUrl
  const params = new URLSearchParams()
  params.append('mode', 'payment')
  params.append('success_url', `${process.env.NEXT_PUBLIC_SITE_URL}/success?ref=${encodeURIComponent(reference)}`)
  params.append('cancel_url', `${process.env.NEXT_PUBLIC_SITE_URL}/appointments/${encodeURIComponent(reference)}`)
  params.append('line_items[0][price_data][currency]', 'brl')
  params.append('line_items[0][price_data][product_data][name]', title)
  params.append('line_items[0][price_data][unit_amount]', amount_cents.toString())
  params.append('line_items[0][quantity]', '1')
  params.append('metadata[appointment_id]', reference)
  if (mode) params.append('metadata[payment_mode]', mode)

  params.append('payment_intent_data[metadata][appointment_id]', reference)
  if (mode) params.append('payment_intent_data[metadata][payment_mode]', mode)

  if (customer?.email) params.append('customer_email', customer.email)
  if (customer?.name) params.append('metadata[customer_name]', customer.name)
  if (customer?.phone) params.append('metadata[customer_phone]', customer.phone)

  const session = (await stripeFetch('/checkout/sessions', {
    method: 'POST',
    body: params,
  })) as StripeCheckoutSession

  return {
    id: session.id as string,
    checkout_url: (session.url as string | null) ?? null,
    session,
  }
}

export async function getPayment(sessionId: string) {
  const params = new URLSearchParams()
  params.append('expand[]', 'payment_intent')
  params.append('expand[]', 'payment_intent.charges')

  return stripeFetch(`/checkout/sessions/${sessionId}?${params.toString()}`) as Promise<StripeCheckoutSession>
}

export async function findSessionByPaymentIntent(paymentIntentId: string) {
  const params = new URLSearchParams()
  params.append('payment_intent', paymentIntentId)
  params.append('limit', '1')

  const list = (await stripeFetch(`/checkout/sessions?${params.toString()}`)) as StripeJson & {
    data?: StripeCheckoutSession[]
  }
  const data = Array.isArray(list.data) ? list.data : []
  return data[0] ?? null
}

export async function refundPayment(sessionId: string, amount_cents?: number) {
  const session = await getPayment(sessionId)
  const paymentIntent = session.payment_intent as StripePaymentIntent | string | undefined
  const paymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id

  if (!paymentIntentId) {
    throw new Error('Pagamento Stripe sem payment_intent disponível')
  }

  const params = new URLSearchParams()
  params.append('payment_intent', paymentIntentId)
  if (typeof amount_cents === 'number') {
    params.append('amount', Math.round(amount_cents).toString())
  }

  return stripeFetch('/refunds', {
    method: 'POST',
    body: params,
  })
}
