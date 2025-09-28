'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/db'

import styles from './newAppointment.module.css'

type ServiceTechnique = {
  id: string
  name: string
  slug: string | null
  duration_min: number
  price_cents: number
  deposit_cents: number
  buffer_min: number | null
  active: boolean
}

type ServiceTypeEntry = {
  id: string
  name: string
  slug: string | null
  description: string | null
  order_index: number
  active: boolean
  services: ServiceTechnique[]
}

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
  services?:
    | { buffer_min?: number | null }[]
    | { buffer_min?: number | null }
    | null
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

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function getBufferMinutesFromAppointment(appt: LoadedAppointment, fallback: number): number {
  const entries = Array.isArray(appt.services)
    ? appt.services
    : appt.services
    ? [appt.services]
    : []

  for (const entry of entries) {
    const normalized = normalizeNumber(entry?.buffer_min)
    if (normalized !== null) {
      return Math.max(0, normalized)
    }
  }

  return Math.max(0, fallback)
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
const FALLBACK_BUFFER_MINUTES = Number(process.env.NEXT_PUBLIC_DEFAULT_BUFFER_MIN ?? '15') || 15
const WORK_DAY_END = '18:00'

function buildAvailabilityData(
  appointments: LoadedAppointment[],
  userId: string | null,
  fallbackBufferMinutes = FALLBACK_BUFFER_MINUTES,
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
    const bufferMinutes = getBufferMinutesFromAppointment(appt, fallbackBufferMinutes)
    const endWithBuffer = new Date(rawEnd.getTime() + bufferMinutes * 60000)

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
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [serviceTypes, setServiceTypes] = useState<ServiceTypeEntry[]>([])
  const [catalogStatus, setCatalogStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [appointments, setAppointments] = useState<LoadedAppointment[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      setCatalogStatus('loading')
      setCatalogError(null)

      try {
        const { data, error } = await supabase
          .from('service_types')
          .select(
            'id, name, slug, description, active, order_index, services:services!services_service_type_id_fkey(id, name, slug, duration_min, price_cents, deposit_cents, buffer_min, active)'
          )
          .eq('active', true)
          .order('order_index', { ascending: true, nullsFirst: true })
          .order('name', { ascending: true })

        if (error) throw error
        if (!active) return

        const normalized = (data ?? []).map((entry) => {
          const servicesRaw = Array.isArray(entry.services)
            ? entry.services
            : entry.services
            ? [entry.services]
            : []

          const services = servicesRaw
            .filter((svc) => svc && svc.active !== false)
            .map((svc) => {
              const duration = normalizeNumber(svc?.duration_min) ?? 0
              const price = normalizeNumber(svc?.price_cents) ?? 0
              const deposit = normalizeNumber(svc?.deposit_cents) ?? 0
              const buffer = normalizeNumber(svc?.buffer_min)

              return {
                id: svc.id,
                name: svc.name ?? 'Serviço',
                slug: svc.slug ?? null,
                duration_min: Math.max(0, Math.round(duration)),
                price_cents: Math.max(0, Math.round(price)),
                deposit_cents: Math.max(0, Math.round(deposit)),
                buffer_min: buffer !== null ? Math.max(0, Math.round(buffer)) : null,
                active: svc.active !== false,
              }
            })
            .filter((svc) => svc.duration_min > 0)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

          const orderIndex = normalizeNumber(entry.order_index)

          return {
            id: entry.id,
            name: entry.name ?? 'Serviço',
            slug: entry.slug ?? null,
            description: entry.description ?? null,
            order_index: orderIndex !== null ? Math.round(orderIndex) : 0,
            active: entry.active !== false,
            services,
          }
        }) satisfies ServiceTypeEntry[]

        normalized.sort(
          (a, b) =>
            a.order_index - b.order_index || a.name.localeCompare(b.name, 'pt-BR')
        )

        setServiceTypes(normalized)
        setCatalogStatus('ready')
      } catch (error) {
        console.error('Erro ao carregar serviços', error)
        if (!active) return
        setServiceTypes([])
        setCatalogStatus('error')
        setCatalogError('Não foi possível carregar os serviços disponíveis. Tente novamente mais tarde.')
      }
    }

    void loadCatalog()

    return () => {
      active = false
    }
  }, [])

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
          .select('id, scheduled_at, starts_at, ends_at, status, customer_id, services(buffer_min)')
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

  const availableTypes = useMemo(
    () => serviceTypes.filter((type) => type.services.length > 0),
    [serviceTypes],
  )

  useEffect(() => {
    if (catalogStatus !== 'ready') return

    if (availableTypes.length === 0) {
      setSelectedTypeId(null)
      return
    }

    if (!selectedTypeId || !availableTypes.some((type) => type.id === selectedTypeId)) {
      setSelectedTypeId(availableTypes[0].id)
    }
  }, [availableTypes, catalogStatus, selectedTypeId])

  const selectedType = useMemo(
    () => availableTypes.find((type) => type.id === selectedTypeId) ?? null,
    [availableTypes, selectedTypeId],
  )

  useEffect(() => {
    if (!selectedType) {
      setSelectedServiceId(null)
      return
    }

    const activeServices = selectedType.services
    if (activeServices.length === 0) {
      setSelectedServiceId(null)
      return
    }

    if (!selectedServiceId || !activeServices.some((svc) => svc.id === selectedServiceId)) {
      setSelectedServiceId(activeServices[0].id)
    }
  }, [selectedServiceId, selectedType])

  const selectedService = useMemo(
    () => selectedType?.services.find((svc) => svc.id === selectedServiceId) ?? null,
    [selectedServiceId, selectedType],
  )

  useEffect(() => {
    setSelectedSlot(null)
  }, [selectedServiceId])

  const availability = useMemo(
    () => buildAvailabilityData(appointments, userId, FALLBACK_BUFFER_MINUTES),
    [appointments, userId],
  )

  const monthTitle = useMemo(() => {
    const localeTitle = new Date(year, month, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
    return localeTitle.charAt(0).toUpperCase() + localeTitle.slice(1)
  }, [month, year])

  const serviceBufferMinutes = useMemo(() => {
    const normalized = normalizeNumber(selectedService?.buffer_min)
    const fallback = FALLBACK_BUFFER_MINUTES
    if (normalized === null) return Math.max(0, fallback)
    return Math.max(0, Math.round(normalized))
  }, [selectedService])

  const computed = useMemo(() => {
    if (!selectedType || !selectedService) {
      return {
        total: 0,
        deposit: 0,
        durationMinutes: 0,
        escolha: 'Selecione um serviço',
        quando: `Data: ${formatIsoDateToBR(selectedDate)} • Horário: ${selectedSlot ?? '—'}`,
      }
    }

    const total = Math.max(0, selectedService.price_cents / 100)
    const depositRaw = Math.max(0, selectedService.deposit_cents / 100)
    const deposit = depositRaw > total ? total : depositRaw

    return {
      total,
      deposit,
      durationMinutes: selectedService.duration_min,
      escolha: `${selectedType.name} • ${selectedService.name}`,
      quando: `Data: ${formatIsoDateToBR(selectedDate)} • Horário: ${selectedSlot ?? '—'}`,
    }
  }, [selectedDate, selectedService, selectedSlot, selectedType])

  const canInteract =
    catalogStatus === 'ready' &&
    !!selectedService &&
    !isLoadingAvailability &&
    !availabilityError

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
    if (!selectedDate || !canInteract || !selectedService) return []

    const durationMinutes = selectedService.duration_min
    if (!durationMinutes) return []

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

      const slotEnd = new Date(slotStart.getTime() + (durationMinutes + serviceBufferMinutes) * 60000)
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
  }, [availability.busyIntervals, availability.daySlots, canInteract, now, selectedDate, selectedService, serviceBufferMinutes])

  const bookedSlots = useMemo(() => new Set<string>(), [])

  useEffect(() => {
    if (!selectedSlot) return
    if (!slots.includes(selectedSlot)) {
      setSelectedSlot(null)
    }
  }, [selectedSlot, slots])

  const hasMetRequirements = Boolean(selectedDate && selectedSlot && selectedService && canInteract)
  const isReadyToContinue = hasMetRequirements && !isSubmitting
  const shouldShowContinueButton = Boolean(selectedService && (hasMetRequirements || isSubmitting))

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

  function handleTypeSelect(typeId: string) {
    if (typeId === selectedTypeId) return
    setSelectedTypeId(typeId)
    setSubmitError(null)
    setSubmitSuccess(null)
  }

  function handleTechniqueSelect(serviceId: string) {
    if (serviceId === selectedServiceId) return
    setSelectedServiceId(serviceId)
    setSubmitError(null)
    setSubmitSuccess(null)
  }

  async function handleContinue() {
    if (!selectedDate || !selectedSlot || !selectedService || !canInteract) return

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
          service_id: selectedService.id,
          scheduled_at: scheduledAt.toISOString(),
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
          <div className={`${styles.label} ${styles.labelCentered}`}>Tipo</div>
          {catalogError && (
            <div className={`${styles.status} ${styles.statusError}`}>{catalogError}</div>
          )}
          {catalogStatus === 'loading' && !catalogError && (
            <div className={`${styles.status} ${styles.statusInfo}`}>Carregando serviços…</div>
          )}
          {catalogStatus === 'ready' && availableTypes.length === 0 && (
            <div className={styles.meta}>Nenhum serviço disponível no momento.</div>
          )}
          {catalogStatus === 'ready' && availableTypes.length > 0 && (
            <div
              className={`${styles.pills} ${styles.tipoPills}`}
              role="tablist"
              aria-label="Tipo de serviço"
            >
              {availableTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`${styles.pill} ${styles.tipoPill}`}
                  data-active={selectedTypeId === type.id}
                  onClick={() => handleTypeSelect(type.id)}
                >
                  {type.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={`${styles.card} ${styles.section}`} id="tecnica-card">
          <div className={`${styles.label} ${styles.labelCentered}`}>Técnica</div>
          {catalogStatus === 'ready' && selectedType && selectedType.services.length > 0 ? (
            <div className={styles.pills} role="tablist" aria-label="Técnica">
              {selectedType.services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className={styles.pill}
                  data-active={selectedServiceId === service.id}
                  onClick={() => handleTechniqueSelect(service.id)}
                >
                  {service.name}
                </button>
              ))}
            </div>
          ) : catalogStatus === 'ready' ? (
            <div className={`${styles.meta} ${styles.labelCentered}`}>
              Selecione um tipo para ver as técnicas disponíveis.
            </div>
          ) : null}
        </section>

        <section className={`${styles.card} ${styles.section}`} id="extras-card">
          <div className={`${styles.label} ${styles.labelCentered}`}>Detalhes do serviço</div>
          <div className={`${styles.meta} ${styles.labelCentered}`}>
            A densidade é definida automaticamente conforme a técnica escolhida.
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

        <section className={`${styles.card} ${styles.section}`} id="data-card">
          <div className={`${styles.label} ${styles.labelCentered}`}>Data &amp; horário</div>

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

        <section className={`${styles.card} ${styles.section}`} id="regras">
          <div className={styles.label}>Regras rápidas</div>
          <ul className={styles.rules}>
            <li>Manutenção: até 21 dias e com pelo menos 40% de fios.</li>
            <li>Reaplicação: quando não atende às regras de manutenção.</li>
            <li>Sinal para confirmar o horário. Saldo no dia.</li>
          </ul>
        </section>

        <div className={styles.bottomSpacer} />
      </div>

      <footer className={styles.summary}>
        <div className={styles.summaryInner}>
          <div className={styles.grow}>
            <div className={styles.meta}>{computed.escolha}</div>
            <div className={styles.price}>R$ {toBRLCurrency(computed.total)}</div>
            <div className={styles.meta}>Sinal: R$ {toBRLCurrency(computed.deposit)}</div>
            <div className={styles.meta}>{computed.quando}</div>
          </div>
          <div className={styles.actions}>
            {shouldShowContinueButton && (
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
            )}
            {submitError && <div className={`${styles.status} ${styles.statusError}`}>{submitError}</div>}
            {submitSuccess && <div className={`${styles.status} ${styles.statusSuccess}`}>{submitSuccess}</div>}
          </div>
        </div>
      </footer>
    </div>
  )
}
