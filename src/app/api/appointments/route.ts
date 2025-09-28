import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { z } from 'zod'

const supabaseAdmin = getSupabaseAdmin()

const ServiceBookingBody = z.object({
  service_id: z.string(),
  staff_id: z.string().optional(),
  starts_at: z.string(),
  utm: z
    .object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
    })
    .optional(),
})

const ExperienceBookingBody = z.object({
  cliente_id: z.string().uuid().optional(),
  service_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  notes: z.string().max(500).optional(),
})

const Body = z.union([ServiceBookingBody, ExperienceBookingBody])

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const json = await req.json()
  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if ('starts_at' in parsed.data) {
    const { service_id, staff_id, starts_at, utm } = parsed.data

    const { data: svc } = await supabaseAdmin
      .from('services')
      .select('id, branch_id, duration_min, price_cents, deposit_cents')
      .eq('id', service_id)
      .single()
    if (!svc) return NextResponse.json({ error: 'service not found' }, { status: 404 })

    let staffId = staff_id as string | null
    if (!staffId) {
      const { data: s } = await supabaseAdmin
        .from('staff')
        .select('id')
        .eq('branch_id', svc.branch_id)
        .eq('active', true)
        .limit(1)
      staffId = s?.[0]?.id || null
    }
    if (!staffId) return NextResponse.json({ error: 'no staff available' }, { status: 400 })

    const start = new Date(starts_at)
    const end = new Date(start.getTime() + svc.duration_min * 60 * 1000)

    const { data: appt, error } = await supabaseAdmin
      .from('appointments')
      .insert({
        branch_id: svc.branch_id,
        customer_id: user.id,
        staff_id: staffId,
        service_id: svc.id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: 'pending',
        total_cents: svc.price_cents,
        deposit_cents: svc.deposit_cents,
        utm_source: utm?.source,
        utm_medium: utm?.medium,
        utm_campaign: utm?.campaign,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error }, { status: 500 })

    return NextResponse.json({ appointment_id: appt.id })
  }

  const { service_id, scheduled_at, notes } = parsed.data

  const { data: svc } = await supabaseAdmin
    .from('services')
    .select('id, branch_id, duration_min, price_cents, deposit_cents')
    .eq('id', service_id)
    .eq('active', true)
    .single()
  if (!svc) return NextResponse.json({ error: 'service not found' }, { status: 404 })

  let staffId: string | null = null
  if (svc.branch_id) {
    const { data: staffRows } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('branch_id', svc.branch_id)
      .eq('active', true)
      .limit(1)
    staffId = staffRows?.[0]?.id || null
  }

  const start = new Date(scheduled_at)
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: 'invalid scheduled_at' }, { status: 400 })
  }

  const end = new Date(start.getTime() + svc.duration_min * 60 * 1000)

  const totalCents = Math.max(0, svc.price_cents)
  const depositCents = Math.min(totalCents, Math.max(0, svc.deposit_cents))
  const priceValue = Number((totalCents / 100).toFixed(2))
  const depositValue = Number((depositCents / 100).toFixed(2))

  const { data: appt, error } = await supabaseAdmin
    .from('appointments')
    .insert({
      branch_id: svc.branch_id,
      customer_id: user.id,
      staff_id: staffId,
      service_id: svc.id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      scheduled_at: start.toISOString(),
      status: 'pending',
      total_cents: totalCents,
      deposit_cents: depositCents,
      preco_total: priceValue,
      valor_sinal: depositValue,
      notes,
    })
    .select('id, scheduled_at')
    .single()

  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ appointment_id: appt.id, scheduled_at: appt.scheduled_at })
}
