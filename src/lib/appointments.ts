import { getSupabaseAdmin } from './db'

const supabaseAdmin = getSupabaseAdmin()

export async function finalizePastAppointments(graceHours = 3) {
  const threshold = new Date(Date.now() - graceHours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .update({ status: 'completed' })
    .lte('starts_at', threshold)
    .in('status', ['pending', 'reserved', 'confirmed'])
    .select('id')

  if (error) {
    throw error
  }

  return data?.length ?? 0
}
