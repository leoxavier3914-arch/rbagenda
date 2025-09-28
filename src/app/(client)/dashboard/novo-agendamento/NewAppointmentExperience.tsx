'use client'

import { useMemo, useState } from 'react'

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

function generateExampleData(): ExampleData {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const format = (date: Date) => date.toISOString().slice(0, 10)
  const addDays = (base: Date, amount: number) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + amount)

  const bookedDays = new Set([1, 7, 15, 21, 28].map((n) => format(addDays(today, n))))
  const myDays = new Set([3, 18].map((n) => format(addDays(today, n))))
  const availableDays = new Set<string>()

  for (let i = 0; i < 60; i += 1) {
    const date = format(addDays(today, i))
    if (!bookedDays.has(date) && !myDays.has(date)) {
      availableDays.add(date)
    }
  }

  const makeSlots = (start = '09:00', end = '18:00', stepMinutes = 30) => {
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

  const daySlots: Record<string, string[]> = {}
  const defaultSlots = makeSlots('09:00', '18:00', 30)
  availableDays.forEach((date) => {
    daySlots[date] = [...defaultSlots]
  })

  const bookedSlots: Record<string, string[]> = {
    [format(addDays(today, 1))]: ['10:00', '10:30', '11:00'],
    [format(addDays(today, 3))]: ['14:00', '14:30'],
    [format(addDays(today, 18))]: ['09:00', '09:30', '10:00'],
  }

  return {
    availableDays,
    bookedDays,
    myDays,
    daySlots,
    bookedSlots,
  }
}

export default function NewAppointmentExperience() {
  const [tipo, setTipo] = useState<Tipo>(DEFAULT_SELECTIONS.tipo)
  const [tecnica, setTecnica] = useState<Tecnica>(DEFAULT_SELECTIONS.tecnica)
  const [densidade, setDensidade] = useState<Densidade>(DEFAULT_SELECTIONS.densidade)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const example = useMemo(() => generateExampleData(), [])

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
      if (example.myDays.has(iso)) status = 'mine'
      else if (example.bookedDays.has(iso)) status = 'booked'
      else if (example.availableDays.has(iso)) status = 'available'

      const isPast = date < today
      const isDisabled = isPast || status === 'booked' || status === 'disabled'

      dayEntries.push({
        iso,
        day,
        isDisabled,
        state: status,
      })
    }

    return { startWeekday, dayEntries }
  }, [example.availableDays, example.bookedDays, example.myDays, month, year])

  const slots = useMemo(() => {
    if (!selectedDate) return []
    return [...(example.daySlots[selectedDate] ?? [])]
  }, [example.daySlots, selectedDate])

  const bookedSlots = useMemo(() => {
    if (!selectedDate) return new Set<string>()
    return new Set(example.bookedSlots[selectedDate] ?? [])
  }, [example.bookedSlots, selectedDate])

  const isReadyToContinue = Boolean(selectedDate && selectedSlot)

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
    if (disabled) return
    setSelectedDate(dayIso)
    setSelectedSlot(null)
  }

  function handleSlotSelect(slotValue: string, disabled: boolean) {
    if (disabled) return
    setSelectedSlot(slotValue)
  }

  function handleContinue() {
    if (!selectedDate || !selectedSlot) return

    const payload = {
      tipo,
      tecnica,
      densidade,
      preco_total: toBRLCurrency(computed.total),
      sinal: toBRLCurrency(computed.sinal),
      duracao: minutesToText(computed.durationMinutes),
      data: selectedDate,
      horario: selectedSlot,
      ts: Date.now(),
    }

    try {
      window.localStorage.setItem('novo-agendamento', JSON.stringify(payload))
    } catch {
      // ignore write errors (storage may be unavailable)
    }

    window.alert(
      `Agendamento salvo!\n${formatIsoDateToBR(selectedDate)} às ${selectedSlot}.\nPróxima etapa: confirmar dados do cliente.`,
    )
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
            {selectedDate ? (
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
          <button
            type="button"
            className={styles.cta}
            disabled={!isReadyToContinue}
            onClick={handleContinue}
          >
            Continuar
          </button>
        </div>
      </footer>
    </div>
  )
}
