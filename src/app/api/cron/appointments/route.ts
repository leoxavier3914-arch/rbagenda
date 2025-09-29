import { NextResponse } from 'next/server'
import {
  cancelExpiredPendingAppointments,
  finalizePastAppointments,
} from '@/lib/appointments'

export async function GET() {
  const [completed, canceled] = await Promise.all([
    finalizePastAppointments(),
    cancelExpiredPendingAppointments(),
  ])

  return NextResponse.json({ ok: true, completed, canceled })
}
