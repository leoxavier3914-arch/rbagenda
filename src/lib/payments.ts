import crypto from 'crypto'

type PagarmePhone = {
  country_code: string
  area_code: string
  number: string
  type: string
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
    document?: string | null
  }
}

type PagarmeCheckout = {
  payment_url?: string | null
  url?: string | null
}

export type PagarmeCharge = {
  id?: string
  status?: string
  paid_amount?: number
  amount?: number
  [key: string]: unknown
}

export type PagarmeOrder = {
  id?: string
  code?: string | null
  metadata?: Record<string, unknown> | null
  charges?: PagarmeCharge[] | null
  checkouts?: PagarmeCheckout[] | null
  [key: string]: unknown
}

const PG_BASE = process.env.PAGARME_API_URL ?? 'https://api.pagar.me/core/v5'

function getApiKey() {
  const key = process.env.PAGARME_API_KEY
  if (!key) {
    throw new Error('Defina PAGARME_API_KEY no ambiente')
  }
  return key
}

function buildAuthHeader() {
  const token = Buffer.from(`${getApiKey()}:`).toString('base64')
  return `Basic ${token}`
}

async function pgFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PG_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: buildAuthHeader(),
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`Pagar.me ${res.status}: ${msg}`)
  }

  return (await res.json()) as T
}

function buildPhones(phone: string | undefined | null): PagarmePhone[] | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return undefined
  const area = digits.slice(0, 2)
  const number = digits.slice(2)
  return [
    {
      country_code: '55',
      area_code: area,
      number,
      type: 'mobile',
    },
  ]
}

export async function createPreference({
  title,
  amount_cents,
  reference,
  notification_url,
  mode,
  customer,
}: CreatePreferenceInput) {
  const idempotencyKey = crypto.randomUUID()

  const metadata: Record<string, unknown> = {
    appointment_id: reference,
    payment_title: title,
  }
  if (mode) {
    metadata.payment_mode = mode
  }

  const customerPayload: Record<string, unknown> = {
    name: customer?.name ?? 'Cliente RB Agenda',
  }
  if (customer?.email) customerPayload.email = customer.email
  if (customer?.document) customerPayload.document = customer.document
  const phones = buildPhones(customer?.phone ?? undefined)
  if (phones) customerPayload.phones = phones

  const body = {
    code: reference,
    items: [
      {
        amount: amount_cents,
        quantity: 1,
        description: title,
      },
    ],
    metadata,
    customer: customerPayload,
    payments: [
      {
        payment_method: 'checkout',
        amount: amount_cents,
        checkout: {
          customer_editable: true,
          expires_in: 60 * 60,
          default_payment_method: 'pix',
          accepted_payment_methods: ['credit_card', 'pix', 'boleto'],
          success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?ref=${encodeURIComponent(reference)}`,
          skip_checkout_success_page: true,
          postback_url: notification_url,
        },
      },
    ],
  }

  const order = await pgFetch<PagarmeOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  })

  if (typeof order.id !== 'string') {
    throw new Error('Ordem do Pagar.me sem ID válido')
  }

  const checkoutList = Array.isArray(order.checkouts) ? order.checkouts : null
  const checkout = checkoutList && checkoutList.length > 0 ? checkoutList[0] : null
  const checkoutUrl =
    checkout && typeof checkout.payment_url === 'string'
      ? checkout.payment_url
      : checkout && typeof checkout.url === 'string'
        ? checkout.url
        : null

  return {
    id: order.id,
    checkout_url: checkoutUrl,
    order,
  }
}

export async function getPayment(orderId: string) {
  return pgFetch<PagarmeOrder>(`/orders/${orderId}`)
}

export async function refundPayment(orderId: string, amount_cents?: number) {
  const order = await getPayment(orderId)
  const charges: PagarmeCharge[] = Array.isArray(order.charges) ? order.charges : []

  const paidCharge = charges.find((charge) => charge.status === 'paid' || charge.status === 'partial_paid')

  if (!paidCharge || typeof paidCharge.id !== 'string') {
    throw new Error('Nenhuma cobrança paga encontrada para estornar')
  }

  const payload: Record<string, unknown> = {}
  if (typeof amount_cents === 'number') {
    payload.amount = amount_cents
  }

  return pgFetch(`/charges/${paidCharge.id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
