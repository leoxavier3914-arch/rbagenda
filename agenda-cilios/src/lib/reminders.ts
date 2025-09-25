import { supabaseAdmin } from './db'
import { sendWhatsApp } from './whatsapp'

export async function enqueueDefaultReminders(apptId: string) {
  const { data: a } = await supabaseAdmin
    .from('appointments')
    .select('id, starts_at, customer_id, deposit_cents, total_cents, service_id, staff_id')
    .eq('id', apptId).single()
  if (!a) return

  const { data: prof } = await supabaseAdmin.from('profiles').select('whatsapp, full_name').eq('id', a.customer_id).single()
  if (!prof?.whatsapp) return

  const start = new Date(a.starts_at)
  const h24 = new Date(start.getTime() - 24*60*60*1000)
  const h2 = new Date(start.getTime() - 2*60*60*1000)

  const msg24 = `Oi ${prof.full_name?.split(' ')[0]||''}! Lembrete: seu horário de cílios é amanhã às ${start.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}. Chegue sem rímel e com os cílios limpos. 💚`
  const msg2 = `É hoje! Seu horário é às ${start.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}. Qualquer atraso avise por aqui. Até já! ✨`

  await supabaseAdmin.from('reminders').insert([
    {
      appointment_id: apptId,
      channel: 'whatsapp',
      to_address: prof.whatsapp,
      template: 'reminder_24h',
      message: msg24,
      scheduled_at: h24.toISOString()
    },
    {
      appointment_id: apptId,
      channel: 'whatsapp',
      to_address: prof.whatsapp,
      template: 'reminder_2h',
      message: msg2,
      scheduled_at: h2.toISOString()
    },
  ])
}

export async function processDueReminders(limit = 20) {
  const now = new Date().toISOString()
  const { data: due } = await supabaseAdmin
    .from('reminders')
    .select('*')
    .lte('scheduled_at', now)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  for (const r of due || []) {
    try {
      if (r.channel === 'whatsapp') {
        const res = await sendWhatsApp(r.to_address, r.message)
        if (res.ok) {
          await supabaseAdmin.from('reminders').update({ status: 'sent', sent_at: new Date().toISOString(), attempts: r.attempts+1 }).eq('id', r.id)
        } else {
          await supabaseAdmin.from('reminders').update({ status: 'error', last_error: res.note || 'send fail', attempts: r.attempts+1 }).eq('id', r.id)
        }
      }
    } catch (e: unknown) {
      await supabaseAdmin.from('reminders').update({ status: 'error', last_error: String(e), attempts: r.attempts+1 }).eq('id', r.id)
    }
  }
}
