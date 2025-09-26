import Stripe from 'stripe'

export type CreatePreferenceInput = {
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

export type PaymentPreference = {
  id: string
  checkout_url: string | null
  client_secret: string | null
  session: Stripe.Checkout.Session
}

let stripeClient: Stripe | null = null

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error('Defina STRIPE_SECRET_KEY no ambiente')
  }
  stripeClient = new Stripe(secret, {
    apiVersion: '2025-02-24.acacia',
  })
  return stripeClient
}

function buildMetadata({
  reference,
  title,
  mode,
}: Pick<CreatePreferenceInput, 'reference' | 'title' | 'mode'>) {
  const metadata: Record<string, string> = {
    appointment_id: reference,
    payment_title: title,
  }
  if (mode) {
    metadata.payment_mode = mode
  }
  return metadata
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export async function createPreference({
  title,
  amount_cents,
  reference,
  notification_url: _notificationUrl,
  mode,
  customer,
}: CreatePreferenceInput): Promise<PaymentPreference> {
  if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
    throw new Error('Valor inválido para cobrança')
  }

  const stripe = getStripeClient()
  const metadata = buildMetadata({ reference, title, mode })
  if (_notificationUrl) {
    metadata.webhook_url = _notificationUrl
  }
  if (customer?.name) {
    metadata.customer_name = customer.name
  }
  if (customer?.phone) {
    metadata.customer_phone = customer.phone
  }
  if (customer?.document) {
    metadata.customer_document = customer.document
  }
  const siteUrl = getSiteUrl()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ui_mode: 'embedded',
    client_reference_id: reference,
    metadata,
    return_url: `${siteUrl}/success?ref=${encodeURIComponent(reference)}&session_id={CHECKOUT_SESSION_ID}`,
    invoice_creation: { enabled: false },
    automatic_tax: { enabled: false },
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    phone_number_collection: customer?.phone ? { enabled: true } : undefined,
    customer_email: customer?.email ?? undefined,
    payment_intent_data: {
      metadata,
      receipt_email: customer?.email ?? undefined,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'brl',
          unit_amount: amount_cents,
          product_data: {
            name: title,
            metadata,
          },
        },
      },
    ],
  })

  return {
    id: session.id,
    checkout_url: session.url ?? null,
    client_secret: session.client_secret ?? null,
    session,
  }
}

export async function getPayment(sessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient()
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent', 'payment_intent.charges'],
  })
}

export async function refundPayment(sessionId: string, amount_cents?: number) {
  const stripe = getStripeClient()
  const session = await getPayment(sessionId)
  const paymentIntent = session.payment_intent

  const paymentIntentId =
    typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id

  if (!paymentIntentId) {
    throw new Error('Nenhum pagamento confirmado para estornar')
  }

  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: typeof amount_cents === 'number' ? amount_cents : undefined,
  })
}
