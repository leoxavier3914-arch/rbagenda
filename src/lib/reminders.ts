import { getSupabaseAdmin } from './db'
import { sendWhatsApp } from './whatsapp'

const supabaseAdmin = getSupabaseAdmin()

type ReminderRow = {
  id: string
  channel: string
  to_address: string
  message: string
  attempts: number | null
}

function nextAttemptsCount(current: number | null | undefined) {
  return (current ?? 0) + 1
}

export async function enqueueDefaultReminders(apptId: string) {
  const { data: appointment, error: appointmentError } = await supabaseAdmin
    .from('appointments')
    .select('id, starts_at, customer_id')
    .eq('id', apptId)
    .single()

  if (appointmentError) {
    console.error('Erro ao carregar agendamento para lembretes', appointmentError)
    throw appointmentError
  }

  if (!appointment) return

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('whatsapp, full_name')
    .eq('id', appointment.customer_id)
    .single()

  if (profileError) {
    console.error('Erro ao carregar perfil para lembretes', profileError)
    throw profileError
  }

  if (!profile?.whatsapp) return

  const start = new Date(appointment.starts_at)
  if (Number.isNaN(start.getTime())) {
    console.warn('Agendamento sem horário válido para criar lembretes', apptId)
    return
  }

  const h24 = new Date(start.getTime() - 24 * 60 * 60 * 1000)
  const h2 = new Date(start.getTime() - 2 * 60 * 60 * 1000)

  const firstName = profile.full_name?.split(' ')[0] || ''
  const formatTime = () => start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const reminders = [
    {
      appointment_id: apptId,
      channel: 'whatsapp' as const,
      to_address: profile.whatsapp,
      template: 'reminder_24h',
      message: `Oi ${firstName}! Lembrete: seu horário de cílios é amanhã às ${formatTime()}. Chegue sem rímel e com os cílios limpos. 💚`,
      scheduled_at: h24.toISOString(),
    },
    {
      appointment_id: apptId,
      channel: 'whatsapp' as const,
      to_address: profile.whatsapp,
      template: 'reminder_2h',
      message: `É hoje! Seu horário é às ${formatTime()}. Qualquer atraso avise por aqui. Até já! ✨`,
      scheduled_at: h2.toISOString(),
    },
  ]

  const { error: insertError } = await supabaseAdmin.from('reminders').insert(reminders)
  if (insertError) {
    console.error('Erro ao salvar lembretes padrão', insertError)
    throw insertError
  }
}

export async function processDueReminders(limit = 20) {
  const now = new Date().toISOString()
  const { data: due, error } = await supabaseAdmin
    .from('reminders')
    .select('*')
    .lte('scheduled_at', now)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(limit)
    .returns<ReminderRow[]>()

  if (error) {
    console.error('Erro ao consultar lembretes pendentes', error)
    throw error
  }

  if (!due?.length) {
    return { processed: 0, errors: 0 }
  }

  const results = await Promise.allSettled(
    due.map(async (reminder) => {
      if (reminder.channel !== 'whatsapp') {
        await supabaseAdmin
          .from('reminders')
          .update({
            status: 'error',
            last_error: `Canal não suportado: ${reminder.channel}`,
            attempts: nextAttemptsCount(reminder.attempts),
          })
          .eq('id', reminder.id)
        return
      }

      try {
        const response = await sendWhatsApp(reminder.to_address, reminder.message)
        const attempts = nextAttemptsCount(reminder.attempts)

        if (response.ok) {
          await supabaseAdmin
            .from('reminders')
            .update({ status: 'sent', sent_at: new Date().toISOString(), attempts })
            .eq('id', reminder.id)
        } else {
          await supabaseAdmin
            .from('reminders')
            .update({
              status: 'error',
              last_error: response.note ?? 'send fail',
              attempts,
            })
            .eq('id', reminder.id)
        }
      } catch (err) {
        const attempts = nextAttemptsCount(reminder.attempts)
        await supabaseAdmin
          .from('reminders')
          .update({
            status: 'error',
            last_error: err instanceof Error ? err.message : String(err),
            attempts,
          })
          .eq('id', reminder.id)
        throw err
      }
    }),
  )

  const summary = results.reduce(
    (acc, result) => {
      if (result.status === 'fulfilled') {
        acc.processed += 1
      } else {
        acc.errors += 1
        console.error('Falha ao processar lembrete', result.reason)
      }
      return acc
    },
    { processed: 0, errors: 0 },
  )

  return summary
}
