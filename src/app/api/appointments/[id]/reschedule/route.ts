import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

const supabaseAdmin = getSupabaseAdmin()

const HOURS_LIMIT = Number(process.env.DEFAULT_REMARCA_HOURS || 24)

type AppointmentRecord = {
  id: string
  customer_id: string | null
  status: string
  starts_at: string
  service_id: string | null
}

type ServiceRecord = {
  duration_min: number | null
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await context.params
  const body = await req.json().catch(() => null)
  const nextStartsAt = typeof body?.starts_at === 'string' ? new Date(body.starts_at) : null

  if (!nextStartsAt || Number.isNaN(nextStartsAt.getTime())) {
    return NextResponse.json({ error: 'invalid starts_at' }, { status: 400 })
  }

  const { data: appointment } = await supabaseAdmin
    .from('appointments')
    .select('id, customer_id, status, starts_at, service_id')
    .eq('id', id)
    .maybeSingle<AppointmentRecord>()

  if (!appointment || !appointment.customer_id || appointment.customer_id !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  if (appointment.status !== 'pending') {
    return NextResponse.json({ error: 'apenas agendamentos pendentes podem ser alterados' }, { status: 400 })
  }

  const now = Date.now()
  const originalDiff = (new Date(appointment.starts_at).getTime() - now) / 3_600_000
  if (originalDiff < HOURS_LIMIT) {
    return NextResponse.json({ error: 'agendamento bloqueado para alterações' }, { status: 409 })
  }

  const diffNext = (nextStartsAt.getTime() - now) / 3_600_000
  if (diffNext < HOURS_LIMIT) {
    return NextResponse.json({ error: 'a nova data deve respeitar a antecedência mínima' }, { status: 422 })
  }

  const serviceId = appointment.service_id
  if (!serviceId) {
    return NextResponse.json({ error: 'service not found' }, { status: 400 })
  }

  const { data: service } = await supabaseAdmin
    .from('services')
    .select('duration_min')
    .eq('id', serviceId)
    .maybeSingle<ServiceRecord>()

  if (!service) {
    return NextResponse.json({ error: 'service not found' }, { status: 404 })
  }

  const durationMinutes = Math.max(0, Number(service.duration_min) || 0)
  const endsAt = new Date(nextStartsAt.getTime() + durationMinutes * 60 * 1000)

  const { error } = await supabaseAdmin
    .from('appointments')
    .update({
      starts_at: nextStartsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      scheduled_at: nextStartsAt.toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'failed to update appointment' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, starts_at: nextStartsAt.toISOString(), ends_at: endsAt.toISOString() })
}
