const MP_API = 'https://api.mercadopago.com'

async function mpFetch(path: string, init?: RequestInit) {
  const res = await fetch(MP_API + path, {
    ...init,
    headers: {
      'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`MercadoPago ${res.status}`)
  return res.json()
}

export async function createPreference({ title, amount_cents, reference, notification_url }: { title:string, amount_cents:number, reference:string, notification_url:string }) {
  const body = {
    items: [{
      title,
      quantity: 1,
      currency_id: 'BRL',
      unit_price: amount_cents/100
    }],
    external_reference: reference,
    back_urls: {
      success: `${process.env.NEXT_PUBLIC_SITE_URL}/success?ref=${encodeURIComponent(reference)}`,
      failure: `${process.env.NEXT_PUBLIC_SITE_URL}/success?ref=${encodeURIComponent(reference)}`,
      pending: `${process.env.NEXT_PUBLIC_SITE_URL}/success?ref=${encodeURIComponent(reference)}`,
    },
    auto_return: 'approved',
    notification_url,
  }
  return mpFetch('/checkout/preferences', { method: 'POST', body: JSON.stringify(body) })
}

export async function getPayment(id: string) {
  return mpFetch(`/v1/payments/${id}`)
}

export async function refundPayment(id: string, amount_cents?: number) {
  const body = amount_cents ? { amount: amount_cents/100 } : {}
  return mpFetch(`/v1/payments/${id}/refunds`, { method: 'POST', body: JSON.stringify(body) })
}
