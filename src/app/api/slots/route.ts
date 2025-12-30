import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/db'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { resolveServicePricing } from '@/lib/servicePricing'

const supabaseAdmin = getSupabaseAdmin()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const service_id = searchParams.get('service_id')
  const dateStr = searchParams.get('date')
  const staff_id = searchParams.get('staff_id')

  if (!service_id || !dateStr) return NextResponse.json({ error: 'service_id and date required' }, { status: 400 })

  const { data: service } = await supabaseAdmin
    .from('services')
    .select('id, duration_min, branch_id')
    .eq('id', service_id)
    .single()
  if (!service) return NextResponse.json({ slots: [] })

  const { data: branch } = await supabaseAdmin.from('branches').select('timezone').eq('id', service.branch_id).maybeSingle()
  if (!branch) return NextResponse.json({ slots: [] })
  const branchTimezone = branch.timezone || 'America/Sao_Paulo'

  const pricing = await resolveServicePricing(supabaseAdmin, service_id).catch(() => null)
  const durationMinRaw = pricing?.finalValues?.duration_min ?? Number(service.duration_min)
  if (!Number.isFinite(durationMinRaw) || durationMinRaw <= 0) {
    return NextResponse.json({ slots: [] })
  }

  const bufferMinEnv = Number(process.env.DEFAULT_BUFFER_MIN || 15)
  const fallbackBuffer = Number.isFinite(bufferMinEnv) && bufferMinEnv >= 0 ? bufferMinEnv : 15
  const bufferMin = pricing?.finalValues?.buffer_min ?? fallbackBuffer
  const normalizeTime = (time: string) => {
    const [rawHour = '0', rawMinute = '0', rawSecond] = time.split(':')
    const hour = rawHour.padStart(2, '0')
    const minute = rawMinute.padStart(2, '0')
    const second = (rawSecond ?? '00').padStart(2, '0')
    return `${hour}:${minute}:${second}`
  }
  const parseT = (time: string) => fromZonedTime(`${dateStr}T${normalizeTime(time)}`, branchTimezone)

  const dateUtc = parseT('00:00:00')
  const weekday = toZonedTime(dateUtc, branchTimezone).getDay() // 0..6

  const { data: bh } = await supabaseAdmin
    .from('business_hours').select('open_time, close_time')
    .eq('branch_id', service.branch_id).eq('weekday', weekday).maybeSingle()
  if (!bh) return NextResponse.json({ slots: [] })

  let staffId = staff_id as string | null
  if (!staffId) {
    const { data: activeStaff } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('branch_id', service.branch_id)
      .eq('active', true)

    const staffIds = activeStaff?.map((s) => s.id).filter(Boolean) as string[] | undefined

    if (staffIds && staffIds.length > 0) {
      const { data: availableStaff } = await supabaseAdmin
        .from('staff_hours')
        .select('staff_id')
        .eq('weekday', weekday)
        .in('staff_id', staffIds)
        .limit(1)

      staffId = availableStaff?.[0]?.staff_id || null
    }
  }
  if (!staffId) return NextResponse.json({ slots: [] })

  const { data: sh } = await supabaseAdmin
    .from('staff_hours').select('start_time, end_time')
    .eq('staff_id', staffId).eq('weekday', weekday).maybeSingle()
  if (!sh) return NextResponse.json({ slots: [] })

  const dayStart = new Date(Math.max(parseT(bh.open_time).getTime(), parseT(sh.start_time).getTime()))
  const dayEnd = new Date(Math.min(parseT(bh.close_time).getTime(), parseT(sh.end_time).getTime()))
  if (dayEnd <= dayStart) return NextResponse.json({ slots: [] })

  const { data: appts } = await supabaseAdmin
    .from('appointments').select('starts_at, ends_at, status')
    .eq('staff_id', staffId)
    .gte('starts_at', dayStart.toISOString())
    .lte('ends_at', dayEnd.toISOString())
    .not('status', 'eq', 'canceled')

  const { data: offs } = await supabaseAdmin
    .from('blackouts').select('starts_at, ends_at')
    .eq('staff_id', staffId)
    .gte('starts_at', dayStart.toISOString())
    .lte('ends_at', dayEnd.toISOString())

  const busy = [...(appts || []), ...(offs || [])]
    .map((b) => {
      const start = b?.starts_at ? new Date(b.starts_at) : null
      const end = b?.ends_at ? new Date(b.ends_at) : null
      if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
        return null
      }
      return { start, end }
    })
    .filter((entry): entry is { start: Date; end: Date } => Boolean(entry))

  const step = 15
  const need = (durationMinRaw + bufferMin) * 60 * 1000
  const slots: string[] = []

  for (let t = dayStart.getTime(); t + need <= dayEnd.getTime(); t += step*60*1000) {
    const s = new Date(t), e = new Date(t + need)
    const overlaps = busy.some(b => !(e <= b.start || s >= b.end))
    if (!overlaps) slots.push(s.toISOString())
  }

  return NextResponse.json({ staff_id: staffId, slots })
}
