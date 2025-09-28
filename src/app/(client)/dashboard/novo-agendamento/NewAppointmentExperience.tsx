'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/db'

import styles from './newAppointment.module.css'

type Tipo = 'aplicacao' | 'reaplicacao' | 'manutencao'
type Tecnica = 'volume_russo' | 'volume_brasileiro' | 'fox_eyes'
type Densidade = 'natural' | 'intermediario' | 'cheio'

type ExampleData = {
  availableDays: Set<string>
  bookedDays: Set<string>
  myDays: Set<string>
  daySlots: Record<string, string[]>
  bookedSlots: Record<string, string[]>
  busyIntervals: Record<string, Array<{ start: string; end: string }>>
}

type LoadedAppointment = {
  id: string
  scheduled_at: string | null
  starts_at: string
  ends_at: string | null
  status: string
  customer_id: string | null
}

const PRICES: Record<Tipo, Record<Tecnica, number>> = {
  aplicacao: { volume_russo: 220, volume_brasileiro: 240, fox_eyes: 260 },
  reaplicacao: { volume_russo: 200, volume_brasileiro: 220, fox_eyes: 240 },
  manutencao: { volume_russo: 130, volume_brasileiro: 140, fox_eyes: 150 },
}

const DURACOES: Record<Tipo, Record<Tecnica, number>> = {
  aplicacao: { volume_russo: 120, volume_brasileiro: 130, fox_eyes: 140 },
  reaplicacao: { volume_russo: 110, volume_brasileiro: 120, fox_eyes: 130 },
  manutencao: { volume_russo: 70, volume_brasileiro: 80, fox_eyes: 90 },
}

const SINAL_PERCENT: Record<Tipo, number> = {
  aplicacao: 0.3,
  reaplicacao: 0.25,
  manutencao: 0.2,
}

const DENSIDADE_EXTRA: Record<Densidade, number> = {
  natural: 0,
  intermediario: 10,
  cheio: 20,
}

const tipoLabels: Record<Tipo, string> = {
  aplicacao: 'Aplicação',
  reaplicacao: 'Reaplicação',
  manutencao: 'Manutenção',
}

const tecnicaLabels: Record<Tecnica, string> = {
  volume_russo: 'Volume Russo',
  volume_brasileiro: 'Volume Brasileiro',
  fox_eyes: 'Fox Eyes',
}

const densidadeLabels: Record<Densidade, string> = {
  natural: 'Natural',
  intermediario: 'Intermediário',
  cheio: 'Bem cheio',
}

const DEFAULT_SELECTIONS: {
  tipo: Tipo
  tecnica: Tecnica
  densidade: Densidade
} = {
  tipo: 'aplicacao',
  tecnica: 'volume_russo',
  densidade: 'natural',
}

function toBRLCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function toCurrencyNumber(value: number) {
  return Math.round(value * 100) / 100
}

function minutesToText(min: number) {
  const hours = Math.floor(min / 60)
  const minutes = min % 60
  if (!hours) return `${minutes} min`
  if (!minutes) return `${hours}h`
  return `${hours}h ${minutes}min`
}

function formatIsoDateToBR(iso: string | null) {
  if (!iso) return '—'
  return iso.split('-').reverse().join('/')
}

function makeSlots(start = '09:00', end = '18:00', stepMinutes = 30) {
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  const slots: string[] = []
  let cursor = new Date(2000, 0, 1, startHour, startMinute, 0, 0)
  const limit = new Date(2000, 0, 1, endHour, endMinute, 0, 0)

  while (cursor <= limit) {
    const hours = String(cursor.getHours()).padStart(2, '0')
    const minutes = String(cursor.getMinutes()).padStart(2, '0')
    slots.push(`${hours}:${minutes}`)
    cursor = new Date(cursor.getTime() + stepMinutes * 60000)
  }

  return slots
}

const DEFAULT_SLOT_TEMPLATE = makeSlots('09:00', '18:00', 30)
const DEFAULT_BUFFER_MINUTES = Number(process.env.NEXT_PUBLIC_DEFAULT_BUFFER_MIN ?? '15') || 15
const WORK_DAY_END = '18:00'

function buildAvailabilityData(
  appointments: LoadedAppointment[],
  userId: string | null,
  days = 60,
): ExampleData {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daySlots: Record<string, string[]> = {}
  const bookedSlots: Record<string, string[]> = {}
  const busyIntervals: Record<string, Array<{ start: string; end: string }>> = {}
  const availableDays = new Set<string>()
  const bookedDays = new Set<string>()
  const myDays = new Set<string>()

  const perDay = new Map<
    string,
    { times: Set<string>; myTimes: Set<string>; intervals: Array<{ start: string; end: string }> }
  >()

  appointments.forEach((appt) => {
    const rawStart = appt.scheduled_at ?? appt.starts_at
    if (!rawStart) return
    const start = new Date(rawStart)
    if (Number.isNaN(start.getTime())) return
    const isoDay = start.toISOString().slice(0, 10)
    const time = start.toISOString().slice(11, 16)
    const rawEnd = appt.ends_at ? new Date(appt.ends_at) : new Date(start.getTime() + 60 * 60000)
    if (Number.isNaN(rawEnd.getTime())) return
    const endWithBuffer = new Date(rawEnd.getTime() + DEFAULT_BUFFER_MINUTES * 60000)

    if (!perDay.has(isoDay)) {
      perDay.set(isoDay, { times: new Set(), myTimes: new Set(), intervals: [] })
    }

    const entry = perDay.get(isoDay)!
    entry.times.add(time)
    entry.intervals.push({ start: start.toISOString(), end: endWithBuffer.toISOString() })
    if (userId && appt.customer_id === userId) {
      entry.myTimes.add(time)
    }
  })

  for (let i = 0; i < days; i += 1) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const iso = date.toISOString().slice(0, 10)
    daySlots[iso] = [...DEFAULT_SLOT_TEMPLATE]

    const entry = perDay.get(iso)
    if (entry) {
      const sortedTimes = Array.from(entry.times).sort()
      if (sortedTimes.length > 0) {
        bookedSlots[iso] = sortedTimes
      }

      if (entry.intervals.length > 0) {
        busyIntervals[iso] = entry.intervals.sort((a, b) => a.start.localeCompare(b.start))
      }

      if (entry.myTimes.size > 0) {
        myDays.add(iso)
      }

      if (entry.myTimes.size === 0) {
        const totalSlots = daySlots[iso]?.length ?? DEFAULT_SLOT_TEMPLATE.length
        if (entry.times.size >= totalSlots) {
          bookedDays.add(iso)
        } else {
          availableDays.add(iso)
        }
      }
    } else {
      availableDays.add(iso)
    }
  }

  return { availableDays, bookedDays, myDays, daySlots, bookedSlots, busyIntervals }
}

function combineDateAndTime(dateIso: string, time: string) {
  const [year, month, day] = dateIso.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)

  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    return null
  }

  return new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, 0, 0)
}

export default function NewAppointmentExperience() {
  const router = useRouter()
  const [tipo, setTipo] = useState<Tipo>(DEFAULT_SELECTIONS.tipo)
  const [tecnica, setTecnica] = useState<Tecnica>(DEFAULT_SELECTIONS.tecnica)
  const [densidade, setDensidade] = useState<Densidade>(DEFAULT_SELECTIONS.densidade)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [appointments, setAppointments] = useState<LoadedAppointment[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadAvailability() {
      setIsLoadingAvailability(true)
      setAvailabilityError(null)

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        const session = sessionData.session
        if (!session?.user?.id) {
          window.location.href = '/login'
          return
        }

        if (!isMounted) return
        setUserId(session.user.id)

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const limit = new Date(today)
        limit.setDate(limit.getDate() + 60)

        const { data, error } = await supabase
          .from('appointments')
          .select('id, scheduled_at, starts_at, ends_at, status, customer_id')
          .gte('starts_at', today.toISOString())
          .lte('starts_at', limit.toISOString())
          .in('status', ['pending', 'reserved', 'confirmed'])
          .order('starts_at', { ascending: true })

        if (error) throw error
        if (!isMounted) return

        setAppointments(data ?? [])
      } catch (err) {
        console.error('Erro ao carregar disponibilidade', err)
        if (isMounted) {
          setAvailabilityError('Não foi possível carregar a disponibilidade. Tente novamente mais tarde.')
          setAppointments([])
        }
      } finally {
        if (isMounted) {
          setIsLoadingAvailability(false)
        }
      }
    }

    void loadAvailability()

    return () => {
      isMounted = false
    }
  }, [])

  const availability = useMemo(
    () => buildAvailabilityData(appointments, userId),
    [appointments, userId],
  )

  const canInteract = !isLoadingAvailability && !availabilityError

  const monthTitle = useMemo(() => {
    const localeTitle = new Date(year, month, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
    return localeTitle.charAt(0).toUpperCase() + localeTitle.slice(1)
  }, [month, year])

  const computed = useMemo(() => {
    const basePrice = PRICES[tipo][tecnica]
    const extra = densidade ? DENSIDADE_EXTRA[densidade] : 0
    const total = basePrice + extra
    const sinal = total * (SINAL_PERCENT[tipo] ?? 0.3)
    const durationMinutes = DURACOES[tipo][tecnica]

    return {
      total,
      sinal,
      durationMinutes,
      escolha: `${tipoLabels[tipo]} • ${tecnicaLabels[tecnica]} • Densidade: ${
        densidade ? densidadeLabels[densidade] : '—'
      }`,
      quando: `Data: ${formatIsoDateToBR(selectedDate)} • Horário: ${selectedSlot ?? '—'}`,
    }
  }, [densidade, selectedDate, selectedSlot, tecnica, tipo])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startWeekday = firstDay.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dayEntries: Array<{ iso: string; day: number; isDisabled: boolean; state: string }> = []

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day)
      const iso = date.toISOString().slice(0, 10)

      let status: 'available' | 'booked' | 'mine' | 'disabled' = 'disabled'
      if (availability.myDays.has(iso)) status = 'mine'
      else if (availability.bookedDays.has(iso)) status = 'booked'
      else if (availability.availableDays.has(iso)) status = 'available'

      const isPast = date < today
      const isDisabled = !canInteract || isPast || status === 'booked' || status === 'disabled'

      dayEntries.push({
        iso,
        day,
        isDisabled,
        state: status,
      })
    }

    return { startWeekday, dayEntries }
  }, [availability.availableDays, availability.bookedDays, availability.myDays, canInteract, month, year])

  const slots = useMemo(() => {
    if (!selectedDate || !canInteract) return []

    const durationMinutes = DURACOES[tipo][tecnica]
    const busy = availability.busyIntervals[selectedDate] ?? []
    const template = availability.daySlots[selectedDate] ?? DEFAULT_SLOT_TEMPLATE

    const closing = combineDateAndTime(selectedDate, WORK_DAY_END)
    if (!closing) return []

    const todayIso = now.toISOString().slice(0, 10)

    return template.filter((slotValue) => {
      const slotStart = combineDateAndTime(selectedDate, slotValue)
      if (!slotStart) return false

      if (selectedDate === todayIso && slotStart <= now) {
        return false
      }

      const slotEnd = new Date(slotStart.getTime() + (durationMinutes + DEFAULT_BUFFER_MINUTES) * 60000)
      if (slotEnd > closing) {
        return false
      }

      const overlaps = busy.some(({ start, end }) => {
        const busyStart = new Date(start)
        const busyEnd = new Date(end)
        if (Number.isNaN(busyStart.getTime()) || Number.isNaN(busyEnd.getTime())) {
          return false
        }
        return slotEnd > busyStart && slotStart < busyEnd
      })

      return !overlaps
    })
  }, [availability.busyIntervals, availability.daySlots, canInteract, now, selectedDate, tecnica, tipo])

  const bookedSlots = useMemo(() => new Set<string>(), [])

  useEffect(() => {
    if (!selectedSlot) return
    if (!slots.includes(selectedSlot)) {
      setSelectedSlot(null)
    }
  }, [selectedSlot, slots])

  const isReadyToContinue = Boolean(selectedDate && selectedSlot && !isSubmitting && canInteract)

  function goToPreviousMonth() {
    const previous = new Date(year, month - 1, 1)
    setYear(previous.getFullYear())
    setMonth(previous.getMonth())
  }

  function goToNextMonth() {
    const next = new Date(year, month + 1, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }

  function handleDaySelect(dayIso: string, disabled: boolean) {
    if (disabled || !canInteract) return
    setSelectedDate(dayIso)
    setSelectedSlot(null)
    setSubmitError(null)
    setSubmitSuccess(null)
  }

  function handleSlotSelect(slotValue: string, disabled: boolean) {
    if (disabled || !canInteract) return
    setSelectedSlot(slotValue)
    setSubmitError(null)
    setSubmitSuccess(null)
  }

  async function handleContinue() {
    if (!selectedDate || !selectedSlot || !canInteract) return

    setSubmitError(null)
    setSubmitSuccess(null)
    setIsSubmitting(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      const session = sessionData.session
      if (!session?.access_token || !session.user?.id) {
        window.location.href = '/login'
        return
      }

      const scheduledAt = combineDateAndTime(selectedDate, selectedSlot)
      if (!scheduledAt) {
        throw new Error('Horário selecionado é inválido.')
      }

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cliente_id: session.user.id,
          tipo,
          tecnica,
          densidade,
          scheduled_at: scheduledAt.toISOString(),
          preco_total: toCurrencyNumber(computed.total),
          valor_sinal: toCurrencyNumber(computed.sinal),
          duration_minutes: computed.durationMinutes,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const errorMessage =
          (body && typeof body.error === 'string' && body.error) ||
          'Não foi possível criar o agendamento. Tente novamente.'
        throw new Error(errorMessage)
      }

      const payload = await response.json().catch(() => ({}))
      const appointmentId = payload?.appointment_id as string | undefined

      setSubmitSuccess('Agendamento criado com sucesso! Redirecionando…')

      window.setTimeout(() => {
        const target = appointmentId
          ? `/dashboard/agendamentos?novo=${encodeURIComponent(appointmentId)}`
          : '/dashboard/agendamentos'
        router.push(target)
      }, 600)
    } catch (error) {
      console.error('Erro ao criar agendamento', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Erro inesperado ao criar o agendamento. Tente novamente.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <h1 className={styles.title}>Novo agendamento</h1>
        <p className={styles.subtitle}>
          Escolha o tipo, técnica, data e horário. O preço, tempo e sinal atualizam automaticamente.
        </p>

        <section className={`${styles.card} ${styles.section}`} id="tipo-card">
          <div className={styles.label}>Tipo</div>
          <div className={styles.pills} role="tablist" aria-label="Tipo de serviço">
            {(Object.keys(tipoLabels) as Tipo[]).map((value) => (
              <button
                key={value}
                type="button"
                className={styles.pill}
                data-active={tipo === value}
                onClick={() => setTipo(value)}
              >
                {tipoLabels[value]}
              </button>
            ))}
          </div>
        </section>

        <section className={`${styles.card} ${styles.section}`} id="tecnica-card">
          <div className={styles.label}>Técnica</div>
          <div className={styles.pills} role="tablist" aria-label="Técnica">
            {(Object.keys(tecnicaLabels) as Tecnica[]).map((value) => (
              <button
                key={value}
                type="button"
                className={styles.pill}
                data-active={tecnica === value}
                onClick={() => setTecnica(value)}
              >
                {tecnicaLabels[value]}
              </button>
            ))}
          </div>
        </section>

        <section className={`${styles.card} ${styles.section}`} id="extras-card">
          <div className={styles.label}>Densidade (opcional)</div>
          <div className={styles.pills} role="tablist" aria-label="Densidade">
            {(Object.keys(densidadeLabels) as Densidade[]).map((value) => (
              <button
                key={value}
                type="button"
                className={styles.pill}
                data-active={densidade === value}
                onClick={() => setDensidade(value)}
              >
                {densidadeLabels[value]}
              </button>
            ))}
          </div>

          <div className={styles.spacer} />

          <div className={styles.row}>
            <div className={styles.col}>
              <div className={styles.optRow}>
                <div className={styles.left}>
                  <div className={styles.icon} aria-hidden="true">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"
                        stroke="#1f8a70"
                        strokeWidth="1.6"
                      />
                      <circle cx="12" cy="12" r="3" stroke="#1f8a70" strokeWidth="1.6" />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.optTitle}>Alongamento seguro</div>
                    <div className={styles.meta}>Isolamento e cola adequada para durabilidade</div>
                  </div>
                </div>
                <div className={styles.meta}>incluído</div>
              </div>
            </div>
            <div className={styles.col}>
              <div className={styles.optRow}>
                <div className={styles.left}>
                  <div className={styles.icon} aria-hidden="true">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="12" cy="12" r="9" stroke="#1f8a70" strokeWidth="1.6" />
                      <path
                        d="M12 7v5l3 2"
                        stroke="#1f8a70"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.optTitle}>Duração estimada</div>
                    <div className={styles.meta}>{minutesToText(computed.durationMinutes)}</div>
                  </div>
                </div>
                <div className={styles.meta} />
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.card} ${styles.section}`} id="regras">
          <div className={styles.label}>Regras rápidas</div>
          <ul className={styles.rules}>
            <li>Manutenção: até 21 dias e com pelo menos 40% de fios.</li>
            <li>Reaplicação: quando não atende às regras de manutenção.</li>
            <li>Sinal para confirmar o horário. Saldo no dia.</li>
          </ul>
        </section>

        <section className={`${styles.card} ${styles.section}`} id="data-card">
          <div className={styles.label}>Data &amp; horário</div>

          {availabilityError && (
            <div className={`${styles.status} ${styles.statusError}`}>{availabilityError}</div>
          )}

          {!availabilityError && isLoadingAvailability && (
            <div className={`${styles.status} ${styles.statusInfo}`}>Carregando disponibilidade…</div>
          )}

          <div className={styles.calHead}>
            <button
              type="button"
              className={styles.btn}
              aria-label="Mês anterior"
              onClick={goToPreviousMonth}
            >
              ‹
            </button>
            <div className={styles.calTitle} id="cal-title">
              {monthTitle}
            </div>
            <button
              type="button"
              className={styles.btn}
              aria-label="Próximo mês"
              onClick={goToNextMonth}
            >
              ›
            </button>
          </div>

          <div className={styles.grid} aria-hidden="true">
            <div className={styles.dow}>D</div>
            <div className={styles.dow}>S</div>
            <div className={styles.dow}>T</div>
            <div className={styles.dow}>Q</div>
            <div className={styles.dow}>Q</div>
            <div className={styles.dow}>S</div>
            <div className={styles.dow}>S</div>
          </div>

          <div className={styles.grid}>
            {Array.from({ length: calendarDays.startWeekday }).map((_, index) => (
              <div key={`spacer-${index}`} aria-hidden="true" />
            ))}

            {calendarDays.dayEntries.map(({ iso, day, isDisabled, state }) => (
              <button
                key={iso}
                type="button"
                className={styles.day}
                data-state={state}
                data-selected={selectedDate === iso}
                aria-disabled={isDisabled}
                disabled={isDisabled}
                onClick={() => handleDaySelect(iso, isDisabled)}
              >
                {day}
              </button>
            ))}
          </div>

          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotAvail}`} /> Disponível
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotBooked}`} /> Agendado
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotMine}`} /> Meus agendamentos
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotDisabled}`} /> Indisponível
            </div>
          </div>

          <div className={styles.spacerSmall} />
          <div className={styles.label}>Horários</div>
          <div className={styles.slots}>
            {availabilityError ? (
              <div className={`${styles.status} ${styles.statusError}`}>
                Não foi possível carregar os horários.
              </div>
            ) : isLoadingAvailability ? (
              <div className={`${styles.status} ${styles.statusInfo}`}>
                Carregando horários disponíveis…
              </div>
            ) : selectedDate ? (
              slots.length > 0 ? (
                slots.map((slotValue) => {
                  const disabled = bookedSlots.has(slotValue)
                  return (
                    <button
                      key={slotValue}
                      type="button"
                      className={styles.slot}
                      aria-disabled={disabled}
                      data-selected={selectedSlot === slotValue}
                      disabled={disabled}
                      onClick={() => handleSlotSelect(slotValue, disabled)}
                    >
                      {slotValue}
                    </button>
                  )
                })
              ) : (
                <div className={styles.meta}>Sem horários para este dia.</div>
              )
            ) : (
              <div className={styles.meta}>Selecione um dia disponível para ver horários.</div>
            )}
          </div>
        </section>

        <div className={styles.bottomSpacer} />
      </div>

      <footer className={styles.summary}>
        <div className={styles.summaryInner}>
          <div className={styles.grow}>
            <div className={styles.meta}>{computed.escolha}</div>
            <div className={styles.price}>R$ {toBRLCurrency(computed.total)}</div>
            <div className={styles.meta}>Sinal: R$ {toBRLCurrency(computed.sinal)}</div>
            <div className={styles.meta}>{computed.quando}</div>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cta}
              disabled={!isReadyToContinue}
              onClick={() => {
                void handleContinue()
              }}
            >
              {isSubmitting ? 'Salvando…' : 'Continuar'}
            </button>
            {submitError && <div className={`${styles.status} ${styles.statusError}`}>{submitError}</div>}
            {submitSuccess && <div className={`${styles.status} ${styles.statusSuccess}`}>{submitSuccess}</div>}
          </div>
        </div>
      </footer>
    </div>
  )
}
