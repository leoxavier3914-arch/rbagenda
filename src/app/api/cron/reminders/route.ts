import { NextResponse } from 'next/server'
import { processDueReminders } from '@/lib/reminders'

export async function GET() {
  await processDueReminders(50)
  return NextResponse.json({ ok: true })
}
