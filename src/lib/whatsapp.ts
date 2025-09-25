export async function sendWhatsApp(to: string, message: string) {
  if (!process.env.WHATSAPP_API_URL || !process.env.WHATSAPP_API_TOKEN) return { ok: false, note: 'no provider configured' }
  const res = await fetch(process.env.WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`
    },
    body: JSON.stringify({ to, message })
  })
  return { ok: res.ok }
}
