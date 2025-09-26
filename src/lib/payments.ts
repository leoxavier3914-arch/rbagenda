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
  intent: Stripe.PaymentIntent
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
  if (customer?.email) {
    metadata.customer_email = customer.email
  }

  const description = `${title} - ${reference}`
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount_cents,
    currency: 'brl',
    description,
    metadata,
    automatic_payment_methods: { enabled: true },
    receipt_email: customer?.email ?? undefined,
  })

  return {
    id: paymentIntent.id,
    checkout_url: null,
    client_secret: paymentIntent.client_secret ?? null,
    intent: paymentIntent,
  }
}

export async function getPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient()
  return stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['charges', 'latest_charge'],
  })
}

export async function refundPayment(paymentIntentId: string, amount_cents?: number) {
  const stripe = getStripeClient()
  const paymentIntent = await getPayment(paymentIntentId)

  if (!paymentIntent || !paymentIntent.id) {
    throw new Error('Nenhum pagamento confirmado para estornar')
  }

  return stripe.refunds.create({
    payment_intent: paymentIntent.id,
    amount: typeof amount_cents === 'number' ? amount_cents : undefined,
  })
}
