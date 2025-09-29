type WhatsAppResult = { ok: boolean; note?: string }

export async function sendWhatsApp(to: string, message: string): Promise<WhatsAppResult> {
  if (!process.env.WHATSAPP_API_URL || !process.env.WHATSAPP_API_TOKEN) {
    return { ok: false, note: 'no provider configured' }
  }

  try {
    const res = await fetch(process.env.WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
      },
      body: JSON.stringify({ to, message }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, note: text || `HTTP ${res.status}` }
    }

    return { ok: true }
  } catch (error) {
    const note = error instanceof Error ? error.message : 'request failed'
    console.error('Erro ao enviar mensagem de WhatsApp', error)
    return { ok: false, note }
  }
}
