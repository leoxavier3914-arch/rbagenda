import { NextResponse } from 'next/server'
import { finalizePastAppointments } from '@/lib/appointments'

export async function GET() {
  const updated = await finalizePastAppointments()
  return NextResponse.json({ ok: true, updated })
}
