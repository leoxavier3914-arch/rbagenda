'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { supabase } from '@/lib/db'
import {
  DEFAULT_FALLBACK_BUFFER_MINUTES,
  DEFAULT_SLOT_TEMPLATE,
  buildAvailabilityData,
  formatDateToIsoDay,
} from '@/lib/availability'

import styles from './newAppointment.module.css'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min'
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (remaining > 0) parts.push(`${remaining} min`)
  return parts.join(' ')
}

let scrollAnimationFrame: number | null = null

function easeInOutCubic(progress: number) {
  if (progress < 0.5) {
    return 4 * progress * progress * progress
  }
  const adjustment = -2 * progress + 2
  return 1 - Math.pow(adjustment, 3) / 2
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function smoothScrollTo(target: number, duration = 850) {
  if (scrollAnimationFrame !== null) {
    cancelAnimationFrame(scrollAnimationFrame)
    scrollAnimationFrame = null
  }

  const startY = window.scrollY
  const distance = target - startY
  const absoluteDistance = Math.abs(distance)

  if (absoluteDistance < 1) {
    window.scrollTo({ top: target })
    return
  }

  if (prefersReducedMotion()) {
    window.scrollTo({ top: target })
    return
  }

  const canUseNativeSmooth =
    typeof document !== 'undefined' &&
    !!document.documentElement &&
    'scrollBehavior' in document.documentElement.style

  if (canUseNativeSmooth) {
    window.scrollTo({ top: target, behavior: 'smooth' })
    return
  }

  const adjustedDuration = Math.min(
    1600,
    Math.max(700, duration, absoluteDistance * 0.9),
  )

  const startTime = performance.now()

  const step = () => {
    const elapsed = performance.now() - startTime
    const progress = Math.min(1, elapsed / adjustedDuration)
    const eased = easeInOutCubic(progress)

    window.scrollTo({ top: startY + distance * eased })

    if (progress < 1) {
      scrollAnimationFrame = requestAnimationFrame(step)
    } else {
      scrollAnimationFrame = null
    }
  }

  scrollAnimationFrame = requestAnimationFrame(step)
}

function scrollElementIntoView(element: HTMLElement | null) {
  if (!element) return

  const performScroll = () => {
    if (!element.isConnected) return

    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight || 0
    const absoluteTop = rect.top + window.scrollY
    const offset = absoluteTop - viewportHeight / 2 + rect.height / 2
    const target = Math.max(0, offset)
    const distance = Math.abs(target - window.scrollY)

    if (distance < 4) return

    const fullyVisible =
      rect.top >= 0 && rect.bottom <= viewportHeight && rect.height <= viewportHeight

    if (fullyVisible) return

    smoothScrollTo(target, 1000)
  }

  const ensureRendered = () => {
    let frame = 0

    const waitForSettled = () => {
      if (!element.isConnected) return
      if (frame >= 3) {
        performScroll()
        return
      }
      frame += 1
      requestAnimationFrame(waitForSettled)
    }

    requestAnimationFrame(waitForSettled)
  }

  const rect = element.getBoundingClientRect()
  if (rect.height > 0 && rect.width > 0) {
    ensureRendered()
    return
  }

  if (typeof ResizeObserver !== 'undefined') {
    let timeoutId: number | null = null
    const observer = new ResizeObserver(() => {
      if (!element.isConnected) {
        observer.disconnect()
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId)
        }
        return
      }

      const { height, width } = element.getBoundingClientRect()
      if (height === 0 || width === 0) {
        return
      }

      observer.disconnect()
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      ensureRendered()
    })

    observer.observe(element)

    timeoutId = window.setTimeout(() => {
      observer.disconnect()
      ensureRendered()
    }, 400)

    return
  }

  ensureRendered()
}

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

type TechniqueEntry = {
  id: string
  name: string
  slug: string | null
  description: string | null
  order_index: number
  active: boolean
  services: ServiceTechnique[]
}

type TechniqueSummary = {
  id: string
  name: string
  slug: string | null
  description: string | null
  order_index: number
}

type ServiceOption = ServiceTechnique & {
  techniques: TechniqueSummary[]
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

  const [techniqueCatalog, setTechniqueCatalog] = useState<TechniqueEntry[]>([])
  const [catalogStatus, setCatalogStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string | null>(null)
  const [showAllTechniques, setShowAllTechniques] = useState(false)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [appointments, setAppointments] = useState<LoadedAppointment[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  const typeCardRef = useRef<HTMLDivElement | null>(null)
  const techniqueCardRef = useRef<HTMLDivElement | null>(null)
  const dateCardRef = useRef<HTMLDivElement | null>(null)
  const slotsContainerRef = useRef<HTMLDivElement | null>(null)
  const summaryRef = useRef<HTMLDivElement | null>(null)

  const lastServiceIdRef = useRef<string | null>(null)
  const lastTechniqueIdRef = useRef<string | null>(null)
  const lastDateRef = useRef<string | null>(null)

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
        }) satisfies TechniqueEntry[]

        normalized.sort(
          (a, b) =>
            a.order_index - b.order_index || a.name.localeCompare(b.name, 'pt-BR')
        )

        setTechniqueCatalog(normalized)
        setCatalogStatus('ready')
      } catch (error) {
        console.error('Erro ao carregar serviços', error)
        if (!active) return
        setTechniqueCatalog([])
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

  const techniqueMap = useMemo(() => {
    const map = new Map<string, TechniqueEntry>()
    techniqueCatalog.forEach((technique) => {
      map.set(technique.id, technique)
    })
    return map
  }, [techniqueCatalog])

  const serviceOptions = useMemo<ServiceOption[]>(() => {
    const grouped = new Map<
      string,
      { service: ServiceTechnique; techniques: Map<string, TechniqueSummary> }
    >()

    techniqueCatalog.forEach((technique) => {
      const techniqueSummary: TechniqueSummary = {
        id: technique.id,
        name: technique.name,
        slug: technique.slug,
        description: technique.description,
        order_index: technique.order_index,
      }

      technique.services.forEach((service) => {
        const existing = grouped.get(service.id)
        if (!existing) {
          grouped.set(service.id, {
            service,
            techniques: new Map([[techniqueSummary.id, techniqueSummary]]),
          })
          return
        }

        if (!existing.techniques.has(techniqueSummary.id)) {
          existing.techniques.set(techniqueSummary.id, techniqueSummary)
        }
      })
    })

    return Array.from(grouped.values())
      .map(({ service, techniques }) => ({
        ...service,
        techniques: Array.from(techniques.values()).sort((a, b) => {
          const orderDiff = a.order_index - b.order_index
          if (orderDiff !== 0) return orderDiff
          return a.name.localeCompare(b.name, 'pt-BR')
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [techniqueCatalog])

  const availableServices = useMemo(
    () => serviceOptions.filter((service) => service.techniques.length > 0),
    [serviceOptions],
  )

  useEffect(() => {
    if (catalogStatus !== 'ready') return

    if (availableServices.length === 0) {
      setSelectedServiceId(null)
      return
    }

    if (selectedServiceId && !availableServices.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(null)
    }
  }, [availableServices, catalogStatus, selectedServiceId])

  const selectedService = useMemo(
    () => availableServices.find((service) => service.id === selectedServiceId) ?? null,
    [availableServices, selectedServiceId],
  )

  const visibleTechniques = useMemo(() => {
    if (!selectedService) return []
    if (showAllTechniques) return selectedService.techniques
    return selectedService.techniques.slice(0, 6)
  }, [selectedService, showAllTechniques])

  useEffect(() => {
    setShowAllTechniques(false)
  }, [selectedServiceId])

  useEffect(() => {
    if (!selectedService) {
      lastServiceIdRef.current = null
      return
    }

    if (lastServiceIdRef.current === selectedService.id) return
    lastServiceIdRef.current = selectedService.id
    scrollElementIntoView(techniqueCardRef.current)
  }, [selectedService])

  useEffect(() => {
    if (!selectedService) {
      if (selectedTechniqueId !== null) {
        setSelectedTechniqueId(null)
      }
      return
    }

    const activeTechniques = selectedService.techniques
    if (activeTechniques.length === 0) {
      if (selectedTechniqueId !== null) {
        setSelectedTechniqueId(null)
      }
      return
    }

    if (selectedTechniqueId && !activeTechniques.some((tech) => tech.id === selectedTechniqueId)) {
      setSelectedTechniqueId(null)
    }
  }, [selectedService, selectedTechniqueId])

  const selectedTechnique = useMemo(() => {
    if (!selectedTechniqueId) return null

    const withinService = selectedService?.techniques.find((tech) => tech.id === selectedTechniqueId)
    if (withinService) return withinService

    const fallback = techniqueMap.get(selectedTechniqueId)
    if (!fallback) return null

    return {
      id: fallback.id,
      name: fallback.name,
      slug: fallback.slug,
      description: fallback.description,
      order_index: fallback.order_index,
    }
  }, [selectedService, selectedTechniqueId, techniqueMap])

  useEffect(() => {
    if (!selectedTechnique) {
      lastTechniqueIdRef.current = null
      return
    }

    if (lastTechniqueIdRef.current === selectedTechnique.id) return
    lastTechniqueIdRef.current = selectedTechnique.id
    scrollElementIntoView(dateCardRef.current)
  }, [selectedTechnique])

  useEffect(() => {
    setSelectedSlot(null)
  }, [selectedTechniqueId])

  useEffect(() => {
    if (!selectedDate) {
      lastDateRef.current = null
      return
    }

    if (lastDateRef.current === selectedDate) return
    lastDateRef.current = selectedDate
    scrollElementIntoView(slotsContainerRef.current)
  }, [selectedDate])

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
    !!selectedTechnique &&
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

  const busyIntervalsForSelectedDate = useMemo(() => {
    if (!selectedDate) return []

    const raw = availability.busyIntervals[selectedDate] ?? []

    return raw
      .map(({ start, end }) => {
        const busyStart = new Date(start)
        const busyEnd = new Date(end)
        if (Number.isNaN(busyStart.getTime()) || Number.isNaN(busyEnd.getTime())) {
          return null
        }
        return { start: busyStart, end: busyEnd }
      })
      .filter((interval): interval is { start: Date; end: Date } => interval !== null)
  }, [availability.busyIntervals, selectedDate])

  const bookedSlots = useMemo(() => {
    if (!selectedDate) return new Set<string>()
    return new Set(availability.bookedSlots[selectedDate] ?? [])
  }, [availability.bookedSlots, selectedDate])

  const slots = useMemo(() => {
    if (!selectedDate || !canInteract || !selectedService) return []

    const durationMinutes = selectedService.duration_min
    if (!durationMinutes) return []

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

      const overlaps = busyIntervalsForSelectedDate.some(({ start, end }) => slotEnd > start && slotStart < end)

      return !overlaps
    })
  }, [
    availability.daySlots,
    busyIntervalsForSelectedDate,
    canInteract,
    now,
    selectedDate,
    selectedService,
    serviceBufferMinutes,
  ])

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

  function handleServiceSelect(serviceId: string) {
    if (serviceId === selectedServiceId) return
    setSelectedServiceId(serviceId)
    setSelectedTechniqueId(null)
    setSelectedDate(null)
    setSelectedSlot(null)
  }

  function handleTechniqueSelect(techniqueId: string) {
    if (techniqueId === selectedTechniqueId) return
    setSelectedTechniqueId(techniqueId)
    setSelectedDate(null)
    setSelectedSlot(null)
  }

  const summaryData = useMemo(() => {
    if (!selectedService || !selectedTechnique || !selectedDate || !selectedSlot) return null

    const appointmentDate =
      combineDateAndTime(selectedDate, selectedSlot) ?? new Date(`${selectedDate}T00:00:00`)

    const priceValue = Number.isFinite(selectedService.price_cents)
      ? selectedService.price_cents / 100
      : 0

    return {
      typeId: selectedService.id,
      typeName: selectedService.name,
      techniqueId: selectedTechnique.id,
      techniqueName: selectedTechnique.name,
      priceLabel: currencyFormatter.format(priceValue),
      durationLabel: formatDuration(selectedService.duration_min),
      dateLabel: dateFormatter.format(appointmentDate),
      timeLabel: selectedSlot,
      payload: {
        typeId: selectedTechnique.id,
        serviceId: selectedService.id,
        date: selectedDate,
        slot: selectedSlot,
      },
    }
  }, [selectedDate, selectedService, selectedSlot, selectedTechnique])

  const handleContinue = useCallback(() => {
    if (!summaryData) return

    window.dispatchEvent(
      new CustomEvent('new-appointment:continue', {
        detail: summaryData.payload,
      }),
    )
  }, [summaryData])

  const hasSummary = !!summaryData

  return (
    <div className={styles.screen} data-has-summary={hasSummary ? 'true' : 'false'}>
      <div className={styles.experience}>
        <section
          ref={typeCardRef}
          className={`${styles.card} ${styles.section} ${styles.cardReveal}`}
          id="tipo-card"
        >
          <div className={`${styles.label} ${styles.labelCentered}`}>Tipo</div>
          {catalogError && <div className={`${styles.status} ${styles.statusError}`}>{catalogError}</div>}
          {catalogStatus === 'loading' && !catalogError && (
            <div className={`${styles.status} ${styles.statusInfo}`}>Carregando tipos…</div>
          )}
          {catalogStatus === 'ready' && availableServices.length === 0 && (
            <div className={styles.meta}>Nenhum tipo disponível no momento.</div>
          )}
          {catalogStatus === 'ready' && availableServices.length > 0 && (
            <div className={`${styles.pills} ${styles.tipoPills}`} role="tablist" aria-label="Tipo">
              {availableServices.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className={`${styles.pill} ${styles.tipoPill}`}
                  data-active={selectedServiceId === service.id}
                  onClick={() => handleServiceSelect(service.id)}
                >
                  {service.name}
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedService ? (
          <section
            ref={techniqueCardRef}
            className={`${styles.card} ${styles.section} ${styles.cardReveal}`}
            id="tecnica-card"
          >
            <div className={`${styles.label} ${styles.labelCentered}`}>Técnica</div>
            {catalogStatus === 'ready' && selectedService.techniques.length > 0 ? (
              <>
                <div className={`${styles.pills} ${styles.techniquePills}`} role="tablist" aria-label="Técnica">
                  {visibleTechniques.map((technique) => (
                    <button
                      key={technique.id}
                      type="button"
                      className={`${styles.pill} ${styles.techniquePill}`}
                      data-active={selectedTechniqueId === technique.id}
                      onClick={() => handleTechniqueSelect(technique.id)}
                    >
                      {technique.name}
                    </button>
                  ))}
                </div>
                {!showAllTechniques && selectedService.techniques.length > 6 && (
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
                Nenhuma técnica disponível para este tipo no momento.
              </div>
            ) : null}
          </section>
        ) : null}

        {selectedTechnique ? (
          <section
            ref={dateCardRef}
            className={`${styles.card} ${styles.section} ${styles.cardReveal}`}
            id="data-card"
          >
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
                <span className={`${styles.dot} ${styles.dotBooked}`} /> Parcial
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotFull}`} /> Lotado
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotMine}`} /> Meus
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotDisabled}`} /> Indisponível
              </div>
            </div>

            <div className={styles.calendarDivider} aria-hidden="true" />

            <div className={styles.spacerSmall} />
            <div className={`${styles.label} ${styles.labelCentered}`}>Horários</div>
            <div ref={slotsContainerRef} className={styles.slots}>
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
      {summaryData ? (
        <div className={styles.summaryBarContainer} data-visible="true" ref={summaryRef}>
          <div className={styles.summaryBar}>
            <div className={styles.summaryContent}>
              <div className={styles.summaryRow}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryItemLabel}>Tipo</span>
                  <span className={styles.summaryItemValue}>{summaryData.typeName}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryItemLabel}>Técnica</span>
                  <span className={styles.summaryItemValue}>{summaryData.techniqueName}</span>
                </div>
              </div>
              <div className={styles.summaryRow}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryItemLabel}>Valor</span>
                  <span className={styles.summaryItemValue}>{summaryData.priceLabel}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryItemLabel}>Duração</span>
                  <span className={styles.summaryItemValue}>{summaryData.durationLabel}</span>
                </div>
              </div>
              <div className={styles.summaryRow}>
                <div className={`${styles.summaryItem} ${styles.summaryItemFull}`}>
                  <span className={styles.summaryItemLabel}>Horário</span>
                  <span className={styles.summaryItemValue}>
                    {summaryData.dateLabel} às {summaryData.timeLabel}
                  </span>
                </div>
              </div>
            </div>
            <button type="button" className={styles.summaryAction} onClick={handleContinue}>
              Continuar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
