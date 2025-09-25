import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const service_id = searchParams.get('service_id')
  const dateStr = searchParams.get('date')
  const staff_id = searchParams.get('staff_id')

  if (!service_id || !dateStr) return NextResponse.json({ error: 'service_id and date required' }, { status: 400 })

  const { data: service } = await supabaseAdmin.from('services').select('id, duration_min, branch_id').eq('id', service_id).single()
  if (!service) return NextResponse.json({ slots: [] })

  const bufferMin = Number(process.env.DEFAULT_BUFFER_MIN || 15)
  const date = new Date(dateStr + 'T00:00:00Z')
  const weekday = date.getUTCDay() // 0..6

  const { data: bh } = await supabaseAdmin
    .from('business_hours').select('open_time, close_time')
    .eq('branch_id', service.branch_id).eq('weekday', weekday).maybeSingle()
  if (!bh) return NextResponse.json({ slots: [] })

  let staffId = staff_id as string | null
  if (!staffId) {
    const { data: s } = await supabaseAdmin.from('staff').select('id').eq('branch_id', service.branch_id).eq('active', true).limit(1)
    staffId = s?.[0]?.id || null
  }
  if (!staffId) return NextResponse.json({ slots: [] })

  const { data: sh } = await supabaseAdmin
    .from('staff_hours').select('start_time, end_time')
    .eq('staff_id', staffId).eq('weekday', weekday).maybeSingle()
  if (!sh) return NextResponse.json({ slots: [] })

  const parseT = (t:string) => {
    const [H,M,S] = t.split(':').map(Number);
    const d=new Date(date);
    d.setUTCHours(H,M,S||0,0);
    return d
  }

  const dayStart = new Date(Math.max(parseT(bh.open_time).getTime(), parseT(sh.start_time).getTime()))
  const dayEnd = new Date(Math.min(parseT(bh.close_time).getTime(), parseT(sh.end_time).getTime()))
  if (dayEnd <= dayStart) return NextResponse.json({ slots: [] })

  const { data: appts } = await supabaseAdmin
    .from('appointments').select('starts_at, ends_at, status')
    .eq('staff_id', staffId)
    .gte('starts_at', dayStart.toISOString())
    .lte('ends_at', dayEnd.toISOString())

  const { data: offs } = await supabaseAdmin
    .from('blackouts').select('starts_at, ends_at')
    .eq('staff_id', staffId)
    .gte('starts_at', dayStart.toISOString())
    .lte('ends_at', dayEnd.toISOString())

  const busy = [...(appts||[]), ...(offs||[])].map(b => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) }))
  const step = 15, need = (service.duration_min + bufferMin) * 60 * 1000
  const slots: string[] = []

  for (let t = dayStart.getTime(); t + need <= dayEnd.getTime(); t += step*60*1000) {
    const s = new Date(t), e = new Date(t + need)
    const overlaps = busy.some(b => !(e <= b.start || s >= b.end))
    if (!overlaps) slots.push(s.toISOString())
  }

  return NextResponse.json({ staff_id: staffId, slots })
}
