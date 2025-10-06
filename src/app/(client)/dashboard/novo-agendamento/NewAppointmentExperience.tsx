'use client'

import { useEffect, useMemo, useState } from 'react'

import { supabase } from '@/lib/db'
import {
  DEFAULT_FALLBACK_BUFFER_MINUTES,
  DEFAULT_SLOT_TEMPLATE,
  buildAvailabilityData,
  formatDateToIsoDay,
} from '@/lib/availability'

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

type ServiceTypeAssignment = {
  services?: ServiceTechnique | ServiceTechnique[] | null
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

type LoadedAppointment = Parameters<typeof buildAvailabilityData>[0][number]

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const FALLBACK_BUFFER_MINUTES = DEFAULT_FALLBACK_BUFFER_MINUTES
const WORK_DAY_END = '18:00'

function combineDateAndTime(dateIso: string, time: string) {
  const [year, month, day] = dateIso.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)

  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    return null
  }

  return new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, 0, 0)
}

export default function NewAppointmentExperience() {
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [serviceTypes, setServiceTypes] = useState<ServiceTypeEntry[]>([])
  const [catalogStatus, setCatalogStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [showAllTechniques, setShowAllTechniques] = useState(false)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [appointments, setAppointments] = useState<LoadedAppointment[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      setCatalogStatus('loading')
      setCatalogError(null)

      try {
        const { data, error } = await supabase
          .from('service_types')
          .select(
            `id, name, slug, description, active, order_index, assignments:service_type_assignments(services:services(id, name, slug, duration_min, price_cents, deposit_cents, buffer_min, active))`
          )
          .eq('active', true)
          .order('order_index', { ascending: true, nullsFirst: true })
          .order('name', { ascending: true })

        if (error) throw error
        if (!active) return

        const normalized = (data ?? []).map((entry) => {
          const assignments = Array.isArray(entry.assignments)
            ? entry.assignments
            : entry.assignments
            ? [entry.assignments]
            : []

          const seenServices = new Set<string>()
          const servicesRaw = assignments.flatMap((assignment: ServiceTypeAssignment) => {
            const related = assignment?.services
            const relatedArray = Array.isArray(related)
              ? related
              : related
              ? [related]
              : []

            return relatedArray.filter((svc): svc is ServiceTechnique => {
              if (!svc || typeof svc.id !== 'string') return false
              if (seenServices.has(svc.id)) return false
              seenServices.add(svc.id)
              return true
            })
          })

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

    if (selectedTypeId && !availableTypes.some((type) => type.id === selectedTypeId)) {
      setSelectedTypeId(null)
    }
  }, [availableTypes, catalogStatus, selectedTypeId])

  const selectedType = useMemo(
    () => availableTypes.find((type) => type.id === selectedTypeId) ?? null,
    [availableTypes, selectedTypeId],
  )

  const visibleServices = useMemo(() => {
    if (!selectedType) return []
    if (showAllTechniques) return selectedType.services
    return selectedType.services.slice(0, 6)
  }, [selectedType, showAllTechniques])

  useEffect(() => {
    setShowAllTechniques(false)
  }, [selectedTypeId])

  useEffect(() => {
    if (!selectedType) {
      if (selectedServiceId !== null) {
        setSelectedServiceId(null)
      }
      return
    }

    const activeServices = selectedType.services
    if (activeServices.length === 0) {
      if (selectedServiceId !== null) {
        setSelectedServiceId(null)
      }
      return
    }

    if (selectedServiceId && !activeServices.some((svc) => svc.id === selectedServiceId)) {
      setSelectedServiceId(null)
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
    () =>
      buildAvailabilityData(appointments, userId, {
        fallbackBufferMinutes: FALLBACK_BUFFER_MINUTES,
      }),
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

  const canInteract =
    catalogStatus === 'ready' &&
    !!selectedService &&
    !isLoadingAvailability &&
    !availabilityError

  const calendarHeaderDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startWeekday = firstDay.getDay()
    const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

    return Array.from({ length: 7 }, (_, index) => labels[(startWeekday + index) % 7])
  }, [month, year])

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dayEntries: Array<{
      iso: string
      day: string
      isDisabled: boolean
      state: string
      isOutsideCurrentMonth: boolean
    }> = []

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day)
      const iso = formatDateToIsoDay(date)

      let status: 'available' | 'booked' | 'full' | 'mine' | 'disabled' = 'disabled'
      if (availability.myDays.has(iso)) status = 'mine'
      else if (availability.bookedDays.has(iso)) status = 'full'
      else if (availability.partiallyBookedDays.has(iso)) status = 'booked'
      else if (availability.availableDays.has(iso)) status = 'available'

      const isPast = date < today
      const isDisabled =
        !canInteract ||
        isPast ||
        status === 'full' ||
        status === 'disabled'

      dayEntries.push({
        iso,
        day: String(day),
        isDisabled,
        state: status,
        isOutsideCurrentMonth: false,
      })
    }

    const trailingSpacers = (7 - (dayEntries.length % 7)) % 7
    for (let day = 1; day <= trailingSpacers; day += 1) {
      dayEntries.push({
        iso: `trailing-${year}-${month}-${day}`,
        day: '',
        isDisabled: true,
        state: 'disabled',
        isOutsideCurrentMonth: true,
      })
    }

    return { dayEntries }
  }, [
    availability.availableDays,
    availability.bookedDays,
    availability.partiallyBookedDays,
    availability.myDays,
    canInteract,
    month,
    year,
  ])

  const slots = useMemo(() => {
    if (!selectedDate || !canInteract || !selectedService) return []

    const durationMinutes = selectedService.duration_min
    if (!durationMinutes) return []

    const busy = availability.busyIntervals[selectedDate] ?? []
    const template = availability.daySlots[selectedDate] ?? DEFAULT_SLOT_TEMPLATE

    const closing = combineDateAndTime(selectedDate, WORK_DAY_END)
    if (!closing) return []

    const todayIso = formatDateToIsoDay(now)

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
  }

  function handleSlotSelect(slotValue: string, disabled: boolean) {
    if (disabled || !canInteract) return
    setSelectedSlot(slotValue)
  }

  function handleTypeSelect(typeId: string) {
    if (typeId === selectedTypeId) return
    setSelectedTypeId(typeId)
    setSelectedServiceId(null)
    setSelectedDate(null)
    setSelectedSlot(null)
  }

  function handleTechniqueSelect(serviceId: string) {
    if (serviceId === selectedServiceId) return
    setSelectedServiceId(serviceId)
    setSelectedDate(null)
    setSelectedSlot(null)
  }

  return (
    <div className={styles.screen}>
    <div className={styles.experience}>
        <section className={`${styles.card} ${styles.section} ${styles.cardReveal}`} id="tecnica-card">
          <div className={`${styles.label} ${styles.labelCentered}`}>Técnica</div>
          {catalogError && <div className={`${styles.status} ${styles.statusError}`}>{catalogError}</div>}
          {catalogStatus === 'loading' && !catalogError && (
            <div className={`${styles.status} ${styles.statusInfo}`}>Carregando técnicas…</div>
          )}
          {catalogStatus === 'ready' && availableTypes.length === 0 && (
            <div className={styles.meta}>Nenhuma técnica disponível no momento.</div>
          )}
          {catalogStatus === 'ready' && availableTypes.length > 0 && (
            <div className={`${styles.pills} ${styles.tipoPills}`} role="tablist" aria-label="Técnica">
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

        {selectedType ? (
          <section className={`${styles.card} ${styles.section} ${styles.cardReveal}`} id="tipo-card">
            <div className={`${styles.label} ${styles.labelCentered}`}>Tipo</div>
            {catalogStatus === 'ready' && selectedType.services.length > 0 ? (
              <>
                <div className={`${styles.pills} ${styles.techniquePills}`} role="tablist" aria-label="Tipo">
                  {visibleServices.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      className={`${styles.pill} ${styles.techniquePill}`}
                      data-active={selectedServiceId === service.id}
                      onClick={() => handleTechniqueSelect(service.id)}
                    >
                      {service.name}
                    </button>
                  ))}
                </div>
                {!showAllTechniques && selectedType.services.length > 6 && (
                  <button
                    type="button"
                    className={styles.viewMoreButton}
                    onClick={() => setShowAllTechniques(true)}
                  >
                    Ver mais
                  </button>
                )}
              </>
            ) : catalogStatus === 'ready' ? (
              <div className={`${styles.meta} ${styles.labelCentered}`}>
                Nenhum tipo disponível para esta técnica no momento.
              </div>
            ) : null}
          </section>
        ) : null}

        {selectedService ? (
          <section className={`${styles.card} ${styles.section} ${styles.cardReveal}`} id="data-card">
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
              {calendarHeaderDays.map((label, index) => (
                <div key={`dow-${index}`} className={styles.dow}>
                  {label}
                </div>
              ))}
            </div>

            <div className={styles.grid}>
              {calendarDays.dayEntries.map(({ iso, day, isDisabled, state, isOutsideCurrentMonth }) => (
                <button
                  key={iso}
                  type="button"
                  className={styles.day}
                  data-state={state}
                  data-selected={!isOutsideCurrentMonth && selectedDate === iso}
                  data-outside-month={isOutsideCurrentMonth ? 'true' : 'false'}
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
                <span className={`${styles.dot} ${styles.dotBooked}`} /> Parcialmente agendado
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotFull}`} /> Lotado
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
        ) : null}
      </div>
    </div>
  )
}
