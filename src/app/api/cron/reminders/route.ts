import { NextResponse } from 'next/server'
import { processDueReminders } from '@/lib/reminders'

export async function GET() {
  try {
    const summary = await processDueReminders(50)
    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    console.error('Erro ao processar lembretes agendados', error)
    return NextResponse.json({ ok: false, error: 'Falha ao processar lembretes' }, { status: 500 })
  }
}
