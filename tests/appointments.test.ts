import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import type { PendingAppointment, PaymentTotal } from '@/lib/appointments'

type CancelFn = (
  appointments: PendingAppointment[],
  totals: PaymentTotal[],
) => PendingAppointment[]

let determinePendingAppointmentsToCancel: CancelFn

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'anon-test-key'
  process.env.SUPABASE_URL ||= process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE ||= 'service-role-test-key'

  const mod = await import('@/lib/appointments')
  determinePendingAppointmentsToCancel = mod.determinePendingAppointmentsToCancel
})

describe('determinePendingAppointmentsToCancel', () => {
  it('marks appointments with no or insufficient deposit as canceled candidates', () => {
    const appointments: PendingAppointment[] = [
      { id: 'no-deposit', deposit_cents: null, valor_sinal: null },
      { id: 'partial', deposit_cents: 5000, valor_sinal: null },
      { id: 'paid', deposit_cents: 5000, valor_sinal: null },
      { id: 'covered', deposit_cents: null, valor_sinal: '75.5' },
      { id: 'string-deposit', deposit_cents: '3500', valor_sinal: null },
    ]

    const totals: PaymentTotal[] = [
      { appointment_id: 'partial', paid_cents: 2500 },
      { appointment_id: 'paid', paid_cents: 5000 },
      { appointment_id: 'covered', paid_cents: 7550 },
      { appointment_id: 'string-deposit', paid_cents: '3499' },
    ]

    const result = determinePendingAppointmentsToCancel(appointments, totals)

    assert.deepEqual(
      result.map((appt) => appt.id),
      ['no-deposit', 'partial', 'string-deposit'],
    )
  })

  it('ignores invalid totals and clamps negatives before comparing', () => {
    const appointments: PendingAppointment[] = [
      { id: 'valid', deposit_cents: null, valor_sinal: '20' },
      { id: 'overpaid', deposit_cents: 1500, valor_sinal: null },
    ]

    const totals: PaymentTotal[] = [
      { appointment_id: 'valid', paid_cents: 'invalid' },
      { appointment_id: 'valid', paid_cents: -500 },
      { appointment_id: 'overpaid', paid_cents: 1500 },
    ]

    const result = determinePendingAppointmentsToCancel(appointments, totals)

    assert.deepEqual(result.map((appt) => appt.id), ['valid'])
  })
})
