'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/db'
import {
  DEFAULT_FALLBACK_BUFFER_MINUTES,
  DEFAULT_SLOT_TEMPLATE,
  buildAvailabilityData,
  formatDateToIsoDay,
} from '@/lib/availability'
import { stripePromise } from '@/lib/stripeClient'

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

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const CARD_SCROLL_DURATION_MS = 900
const CARD_REVEAL_DELAY = 650
const MAX_LAYOUT_CHECKS = 12

function easeInOutCubic(t: number) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function waitForElementLayout(element: HTMLElement): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let attempts = 0

    const check = () => {
      if (!element.isConnected) {
        if (attempts >= MAX_LAYOUT_CHECKS) {
          resolve()
          return
        }
      }

      const rect = element.getBoundingClientRect()
      const isReady = rect.width > 0 && rect.height > 0

      if (isReady || attempts >= MAX_LAYOUT_CHECKS) {
        resolve()
        return
      }

      attempts += 1
      window.requestAnimationFrame(check)
    }

    check()
  })
}

function animateWindowScroll(start: number, target: number, duration: number) {
  if (duration <= 0) {
    window.scrollTo({ top: target, behavior: 'auto' })
    return
  }

  const distance = target - start
  if (Math.abs(distance) < 1) {
    window.scrollTo({ top: target, behavior: 'auto' })
    return
  }

  const startTime = performance.now()

  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(1, elapsed / duration)
    const eased = easeInOutCubic(progress)
    const nextPosition = start + distance * eased

    window.scrollTo({ top: nextPosition, behavior: 'auto' })

    if (progress < 1) {
      window.requestAnimationFrame(step)
    }
  }

  window.requestAnimationFrame(step)
}

async function gentlyCenterCard(element: HTMLElement | null) {
  if (!element || typeof window === 'undefined') return

  await waitForElementLayout(element)

  const rect = element.getBoundingClientRect()
  const viewportHeight = window.innerHeight || 0
  const target = Math.max(0, rect.top + window.scrollY - viewportHeight / 2 + rect.height / 2)

  if (prefersReducedMotion()) {
    window.scrollTo({ top: target, behavior: 'auto' })
    return
  }

  animateWindowScroll(window.scrollY, target, CARD_SCROLL_DURATION_MS)
}

type SectionTitleProps = {
  text: string
  isVisible: boolean
  id: string
  delayMs?: number
}

type SectionTitleWrapperStyle = CSSProperties & { '--title-delay': string }
type TitleCharStyle = CSSProperties & { '--char-index': string }

function SectionTitle({ text, isVisible, id, delayMs = 0 }: SectionTitleProps) {
  const characters = useMemo(() => Array.from(text), [text])

  const wrapperStyle = useMemo<SectionTitleWrapperStyle>(
    () => ({ '--title-delay': `${delayMs}ms` }) satisfies SectionTitleWrapperStyle,
    [delayMs],
  )

  return (
    <div
      className={styles.sectionTitleWrapper}
      data-visible={isVisible ? 'true' : 'false'}
      style={wrapperStyle}
    >
      <h2 id={id} className={styles.sectionTitle}>
        <span aria-hidden="true" className={styles.titleVisual}>
          {characters.map((char, index) => (
            <span
              key={`title-char-${id}-${index}`}
              className={styles.titleChar}
              style={{ '--char-index': `${index}` } satisfies TitleCharStyle}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </span>
        <span className={styles.titleHidden}>{text}</span>
      </h2>
    </div>
  )
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

type SummarySnapshot = {
  typeId: string
  typeName: string
  techniqueId: string
  techniqueName: string
  priceLabel: string
  priceCents: number
  depositLabel: string
  depositCents: number
  durationLabel: string
  dateLabel: string
  timeLabel: string
  payload: {
    typeId: string
    serviceId: string
    date: string
    slot: string
  }
}

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
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false)
  const [isTypeCardVisible, setIsTypeCardVisible] = useState(false)
  const [pendingScrollTarget, setPendingScrollTarget] = useState<
    'technique' | 'date' | null
  >(null)

  const [appointments, setAppointments] = useState<LoadedAppointment[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  const typeCardRef = useRef<HTMLDivElement | null>(null)
  const techniqueCardRef = useRef<HTMLDivElement | null>(null)
  const dateCardRef = useRef<HTMLDivElement | null>(null)
  const slotsContainerRef = useRef<HTMLDivElement | null>(null)
  const summaryRef = useRef<HTMLDivElement | null>(null)

  const router = useRouter()
  const [summarySnapshot, setSummarySnapshot] = useState<SummarySnapshot | null>(null)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [isPayLaterNoticeOpen, setIsPayLaterNoticeOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState<
    { kind: 'success' | 'error'; text: string } | null
  >(null)

  const closeSummaryModal = useCallback(() => {
    setIsSummaryModalOpen(false)
    setModalError(null)
  }, [])

  const handleDismissSummaryModal = useCallback(() => {
    closeSummaryModal()
  }, [closeSummaryModal])

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShouldReduceMotion(true)
      setIsTypeCardVisible(true)
      return
    }

    if (typeof window === 'undefined') {
      setIsTypeCardVisible(true)
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsTypeCardVisible(true)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

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
    setSelectedSlot(null)
  }, [selectedTechniqueId])

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

  useEffect(() => {
    if (!selectedDate) return

    const container = slotsContainerRef.current
    if (!container) return

    let cancelled = false
    let frameId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let transitionHandler: (() => void) | null = null

    const clearTimers = () => {
      if (frameId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(frameId)
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }

    const scheduleScroll = () => {
      if (cancelled) return

      if (typeof window === 'undefined') {
        void gentlyCenterCard(container)
        return
      }

      clearTimers()
      frameId = window.requestAnimationFrame(() => {
        timeoutId = setTimeout(() => {
          if (!cancelled) {
            void gentlyCenterCard(slotsContainerRef.current)
          }
        }, 200)
      })
    }

    if (container.offsetHeight > 0) {
      scheduleScroll()
    } else {
      transitionHandler = () => {
        if (!transitionHandler) return
        container.removeEventListener('transitionend', transitionHandler)
        transitionHandler = null
        scheduleScroll()
      }

      container.addEventListener('transitionend', transitionHandler)
    }

    return () => {
      cancelled = true
      clearTimers()
      if (transitionHandler) {
        container.removeEventListener('transitionend', transitionHandler)
        transitionHandler = null
      }
    }
  }, [selectedDate, slots])

  useEffect(() => {
    if (!pendingScrollTarget) return

    const techniqueVisible = Boolean(selectedService)
    const dateVisible = Boolean(selectedTechnique)

    const targetRef =
      pendingScrollTarget === 'technique' ? techniqueCardRef : dateCardRef
    const shouldShow =
      pendingScrollTarget === 'technique' ? techniqueVisible : dateVisible

    if (!shouldShow) return

    const element = targetRef.current
    if (!element) {
      setPendingScrollTarget(null)
      return
    }

    let cancelled = false
    let frameId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let transitionHandler: (() => void) | null = null

    const clearTimers = () => {
      if (frameId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(frameId)
        frameId = null
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const finishScroll = () => {
      if (cancelled) return
      void gentlyCenterCard(element)
      setPendingScrollTarget(null)
    }

    const scheduleScroll = () => {
      if (cancelled) return

      if (typeof window === 'undefined') {
        finishScroll()
        return
      }

      clearTimers()
      frameId = window.requestAnimationFrame(() => {
        timeoutId = setTimeout(() => {
          finishScroll()
        }, 200)
      })
    }

    if (element.offsetHeight > 0) {
      scheduleScroll()
    } else {
      transitionHandler = () => {
        if (!transitionHandler) return
        element.removeEventListener('transitionend', transitionHandler)
        transitionHandler = null
        scheduleScroll()
      }

      element.addEventListener('transitionend', transitionHandler)
    }

    return () => {
      cancelled = true
      clearTimers()
      if (transitionHandler) {
        element.removeEventListener('transitionend', transitionHandler)
        transitionHandler = null
      }
    }
  }, [pendingScrollTarget, selectedService, selectedTechnique])

  function handleSlotSelect(slotValue: string, disabled: boolean) {
    if (disabled || !canInteract) return
    setSelectedSlot(slotValue)

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        void gentlyCenterCard(summaryRef.current)
      })
    } else {
      void gentlyCenterCard(summaryRef.current)
    }
  }

  function handleServiceSelect(serviceId: string) {
    if (serviceId === selectedServiceId) return
    setSelectedServiceId(serviceId)
    setSelectedTechniqueId(null)
    setSelectedDate(null)
    setSelectedSlot(null)

    setPendingScrollTarget('technique')
  }

  function handleTechniqueSelect(techniqueId: string) {
    if (techniqueId === selectedTechniqueId) return
    setSelectedTechniqueId(techniqueId)
    setSelectedDate(null)
    setSelectedSlot(null)

    setPendingScrollTarget('date')
  }

  const summaryData = useMemo(() => {
    if (!selectedService || !selectedTechnique || !selectedDate || !selectedSlot) return null

    const appointmentDate =
      combineDateAndTime(selectedDate, selectedSlot) ?? new Date(`${selectedDate}T00:00:00`)

    const priceValue = Number.isFinite(selectedService.price_cents)
      ? selectedService.price_cents / 100
      : 0
    const priceCents = Number.isFinite(selectedService.price_cents)
      ? selectedService.price_cents
      : Math.round(priceValue * 100)
    const depositCents = Number.isFinite(selectedService.deposit_cents)
      ? Math.max(0, selectedService.deposit_cents)
      : 0
    const depositValue = depositCents / 100

    return {
      typeId: selectedService.id,
      typeName: selectedService.name,
      techniqueId: selectedTechnique.id,
      techniqueName: selectedTechnique.name,
      priceLabel: currencyFormatter.format(priceValue),
      priceCents,
      depositLabel: currencyFormatter.format(depositValue),
      depositCents,
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

  useEffect(() => {
    setAppointmentId(null)
    setSummarySnapshot(null)
    setModalError(null)
    setIsSummaryModalOpen(false)
    setIsProcessingPayment(false)
    setActionMessage(null)
    setIsPayLaterNoticeOpen(false)
  }, [selectedServiceId, selectedTechniqueId, selectedDate, selectedSlot])

  const ensureSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      throw new Error('Não foi possível validar sua sessão. Faça login novamente.')
    }

    const session = data.session
    if (!session) {
      router.replace('/login')
      throw new Error('Faça login para continuar.')
    }

    return session
  }, [router])

  const isCurrentSelectionBooked = useMemo(() => {
    if (!summaryData || !summarySnapshot || !appointmentId) return false

    return (
      summarySnapshot.payload.serviceId === summaryData.payload.serviceId &&
      summarySnapshot.payload.typeId === summaryData.payload.typeId &&
      summarySnapshot.payload.date === summaryData.payload.date &&
      summarySnapshot.payload.slot === summaryData.payload.slot
    )
  }, [appointmentId, summaryData, summarySnapshot])

  const handleContinue = useCallback(async () => {
    if (!summaryData) return

    setModalError(null)

    if (isCurrentSelectionBooked) {
      setIsSummaryModalOpen(true)
      return
    }

    if (isCreatingAppointment) return

    const currentSummary = summaryData
    setIsCreatingAppointment(true)
    setActionMessage(null)

    try {
      const scheduledDate = combineDateAndTime(
        currentSummary.payload.date,
        currentSummary.payload.slot,
      )
      if (!scheduledDate) {
        throw new Error('Horário selecionado inválido. Escolha outro horário.')
      }

      const session = await ensureSession()

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          service_id: currentSummary.payload.serviceId,
          service_type_id: currentSummary.payload.typeId,
          scheduled_at: scheduledDate.toISOString(),
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : typeof payload?.message === 'string'
            ? payload.message
            : 'Não foi possível criar o agendamento. Tente novamente.'
        throw new Error(message)
      }

      const responseData = await res.json().catch(() => null)
      const newAppointmentId =
        typeof responseData?.appointment_id === 'string'
          ? responseData.appointment_id
          : null

      if (!newAppointmentId) {
        throw new Error('Resposta inválida ao criar o agendamento. Tente novamente.')
      }

      setAppointmentId(newAppointmentId)
      setSummarySnapshot({
        ...currentSummary,
        payload: { ...currentSummary.payload },
      })
      setActionMessage({
        kind: 'success',
        text: `Agendamento criado para ${currentSummary.dateLabel} às ${currentSummary.timeLabel}. ID ${newAppointmentId}.`,
      })
      setIsSummaryModalOpen(true)
    } catch (error) {
      console.error('Erro ao criar agendamento', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível criar o agendamento. Tente novamente.'
      setActionMessage({ kind: 'error', text: message })
    } finally {
      setIsCreatingAppointment(false)
    }
  }, [
    ensureSession,
    isCreatingAppointment,
    isCurrentSelectionBooked,
    summaryData,
  ])

  const handlePayDeposit = useCallback(async () => {
    if (!summarySnapshot || summarySnapshot.depositCents <= 0) {
      setModalError('Este agendamento não possui sinal disponível para pagamento.')
      return
    }

    if (!appointmentId) {
      setModalError('Crie um agendamento antes de iniciar o pagamento.')
      return
    }

    if (!stripePromise) {
      setModalError('Checkout indisponível. Verifique a configuração do Stripe.')
      return
    }

    setModalError(null)
    setIsProcessingPayment(true)

    try {
      const session = await ensureSession()

      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ appointment_id: appointmentId, mode: 'deposit' }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Não foi possível iniciar o checkout.'
        setModalError(message)
        return
      }

      const payload = await res.json().catch(() => null)
      const clientSecret =
        typeof payload?.client_secret === 'string' ? payload.client_secret : null

      if (!clientSecret) {
        setModalError('Resposta inválida do servidor ao iniciar o checkout.')
        return
      }

      closeSummaryModal()
      router.push(
        `/checkout?client_secret=${encodeURIComponent(clientSecret)}&appointment_id=${encodeURIComponent(appointmentId)}`,
      )
    } catch (error) {
      console.error('Erro ao iniciar o checkout', error)
      setModalError('Erro inesperado ao iniciar o checkout.')
    } finally {
      setIsProcessingPayment(false)
    }
  }, [appointmentId, closeSummaryModal, ensureSession, router, summarySnapshot])

  const handlePayLater = useCallback(() => {
    closeSummaryModal()
    setIsPayLaterNoticeOpen(true)
  }, [closeSummaryModal, setIsPayLaterNoticeOpen])

  const handleConfirmPayLaterNotice = useCallback(() => {
    setIsPayLaterNoticeOpen(false)
    router.push('/dashboard/agendamentos')
  }, [router, setIsPayLaterNoticeOpen])

  useEffect(() => {
    if (!isSummaryModalOpen) return
    if (typeof window === 'undefined') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSummaryModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeSummaryModal, isSummaryModalOpen])

  useEffect(() => {
    if (!isPayLaterNoticeOpen) return
    if (typeof window === 'undefined') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPayLaterNoticeOpen])

  const hasSummary = !!summaryData
  const continueButtonLabel = isCreatingAppointment
    ? 'Criando agendamento…'
    : isCurrentSelectionBooked
    ? 'Ver resumo'
    : 'Continuar'
  const continueButtonDisabled = !summaryData || isCreatingAppointment
  const depositAvailable = Boolean(summarySnapshot && summarySnapshot.depositCents > 0)
  const shouldShowTechniqueCard = Boolean(selectedService)
  const shouldShowDateCard = Boolean(selectedTechnique)
  const shouldShowTimeCard = Boolean(selectedTechnique && selectedDate)

  return (
    <div className={styles.screen} data-has-summary={hasSummary ? 'true' : 'false'}>
      <div className={styles.experience}>
        <SectionTitle
          text="Escolha seu Procedimento:"
          isVisible={isTypeCardVisible}
          id="titulo-procedimento"
        />
        <section
          ref={typeCardRef}
          className={styles.cardSection}
          data-kind="type"
          data-visible={isTypeCardVisible ? 'true' : 'false'}
          id="tipo-card"
          aria-hidden={isTypeCardVisible ? 'false' : 'true'}
          aria-labelledby="titulo-procedimento"
          style={{
            '--card-motion-delay': !shouldReduceMotion && isTypeCardVisible
              ? `${CARD_REVEAL_DELAY}ms`
              : '0s',
          } as CSSProperties}
        >
          <div
            className={`${styles.card} ${styles.cardReveal}`}
            style={{
              '--card-reveal-delay': !shouldReduceMotion && isTypeCardVisible
                ? `${CARD_REVEAL_DELAY}ms`
                : '0s',
            } as CSSProperties}
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
          </div>
        </section>

        <SectionTitle
          text="Escolha sua Técnica"
          isVisible={shouldShowTechniqueCard}
          id="titulo-tecnica"
        />
        <section
          ref={techniqueCardRef}
          className={styles.cardSection}
          data-kind="technique"
          data-visible={shouldShowTechniqueCard ? 'true' : 'false'}
          id="tecnica-card"
          aria-hidden={shouldShowTechniqueCard ? 'false' : 'true'}
          aria-labelledby="titulo-tecnica"
          style={{
            '--card-motion-delay': !shouldReduceMotion && shouldShowTechniqueCard
              ? `${CARD_REVEAL_DELAY}ms`
              : '0s',
          } as CSSProperties}
        >
          <div
            className={`${styles.card} ${styles.cardReveal}`}
            style={{
              '--card-reveal-delay': !shouldReduceMotion && shouldShowTechniqueCard
                ? `${CARD_REVEAL_DELAY}ms`
                : '0s',
            } as CSSProperties}
          >
            <div className={`${styles.label} ${styles.labelCentered}`}>Técnica</div>
            {catalogStatus === 'ready' && selectedService && selectedService.techniques.length > 0 ? (
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
            ) : catalogStatus === 'ready' && selectedService ? (
              <div className={`${styles.meta} ${styles.labelCentered}`}>
                Nenhuma técnica disponível para este tipo no momento.
              </div>
            ) : null}
          </div>
        </section>

        <SectionTitle
          text="Escolha o Dia"
          isVisible={shouldShowDateCard}
          id="titulo-dia"
        />
        <section
          ref={dateCardRef}
          className={styles.cardSection}
          data-visible={shouldShowDateCard ? 'true' : 'false'}
          id="data-card"
          aria-hidden={shouldShowDateCard ? 'false' : 'true'}
          aria-labelledby="titulo-dia"
          style={{
            '--card-motion-delay': !shouldReduceMotion && shouldShowDateCard
              ? `${CARD_REVEAL_DELAY}ms`
              : '0s',
          } as CSSProperties}
        >
          <div
            className={`${styles.card} ${styles.cardReveal}`}
            style={{
              '--card-reveal-delay': !shouldReduceMotion && shouldShowDateCard
                ? `${CARD_REVEAL_DELAY}ms`
                : '0s',
            } as CSSProperties}
          >
            <div className={`${styles.label} ${styles.labelCentered}`}>Dia</div>

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

            {!selectedDate && (
              <div className={`${styles.meta} ${styles.dateHint}`}>
                Escolha um dia disponível para liberar os horários.
              </div>
            )}
          </div>
        </section>

        <SectionTitle
          text="Escolha o Horário"
          isVisible={shouldShowTimeCard}
          id="titulo-horario"
        />
        <section
          className={styles.cardSection}
          data-visible={shouldShowTimeCard ? 'true' : 'false'}
          id="time-card"
          aria-hidden={shouldShowTimeCard ? 'false' : 'true'}
          aria-labelledby="titulo-horario"
          style={{
            '--card-motion-delay': !shouldReduceMotion && shouldShowTimeCard
              ? `${CARD_REVEAL_DELAY}ms`
              : '0s',
          } as CSSProperties}
        >
          <div
            className={`${styles.card} ${styles.cardReveal} ${styles.timeCard}`}
            style={{
              '--card-reveal-delay': !shouldReduceMotion && shouldShowTimeCard
                ? `${CARD_REVEAL_DELAY}ms`
                : '0s',
            } as CSSProperties}
          >
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
              ) : slots.length > 0 ? (
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
              )}
            </div>
          </div>
        </section>
      </div>
      {summaryData ? (
        <div
          className={styles.summaryBarContainer}
          data-visible={hasSummary ? 'true' : 'false'}
          ref={summaryRef}
        >
          <div className={styles.summaryBar}>
            <div className={styles.summaryContent}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryItemLabel}>Tipo</span>
                <span className={styles.summaryItemValue}>{summaryData.typeName}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryItemLabel}>Técnica</span>
                <span className={styles.summaryItemValue}>{summaryData.techniqueName}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryItemLabel}>Valor</span>
                <span className={styles.summaryItemValue}>{summaryData.priceLabel}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryItemLabel}>Duração</span>
                <span className={styles.summaryItemValue}>{summaryData.durationLabel}</span>
              </div>
              <div className={`${styles.summaryItem} ${styles.summaryItemFull}`}>
                <span className={styles.summaryItemLabel}>Horário</span>
                <span className={styles.summaryItemValue}>
                  {summaryData.dateLabel} às {summaryData.timeLabel}
                </span>
              </div>
            </div>
            {actionMessage ? (
              <div className={styles.summaryFeedback}>
                <div
                  className={`${styles.status} ${
                    actionMessage.kind === 'success'
                      ? styles.statusSuccess
                      : styles.statusError
                  }`}
                >
                  {actionMessage.text}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className={styles.summaryAction}
              onClick={handleContinue}
              disabled={continueButtonDisabled}
            >
              {continueButtonLabel}
            </button>
          </div>
        </div>
      ) : null}
      {summarySnapshot ? (
        <div
          className={styles.modal}
          data-open={isSummaryModalOpen ? 'true' : 'false'}
          aria-hidden={isSummaryModalOpen ? 'false' : 'true'}
        >
          <div className={styles.modalBackdrop} onClick={handleDismissSummaryModal} aria-hidden="true" />
          <div
            className={styles.modalContent}
            role="dialog"
            aria-modal="true"
            aria-labelledby="appointment-summary-title"
          >
            <h2 id="appointment-summary-title" className={styles.modalTitle}>
              Resumo do agendamento
            </h2>
            <div className={styles.modalBody}>
              <div className={styles.modalLine}>
                <span>Tipo</span>
                <strong>{summarySnapshot.typeName}</strong>
              </div>
              <div className={styles.modalLine}>
                <span>Técnica</span>
                <strong>{summarySnapshot.techniqueName}</strong>
              </div>
              <div className={`${styles.modalLine} ${styles.modalLineHighlight}`}>
                <span>Horário</span>
                <strong>
                  {summarySnapshot.dateLabel} às {summarySnapshot.timeLabel}
                </strong>
              </div>
              <div className={styles.modalLine}>
                <span>Duração</span>
                <strong>{summarySnapshot.durationLabel}</strong>
              </div>
              <div className={styles.modalLine}>
                <span>Valor</span>
                <strong>{summarySnapshot.priceLabel}</strong>
              </div>
              {summarySnapshot.depositCents > 0 ? (
                <div className={styles.modalLine}>
                  <span>Sinal</span>
                  <strong>{summarySnapshot.depositLabel}</strong>
                </div>
              ) : null}
            </div>
            {appointmentId ? (
              <div className={styles.meta}>ID do agendamento: {appointmentId}</div>
            ) : null}
            {!depositAvailable && (
              <div className={`${styles.status} ${styles.statusInfo}`}>
                Este agendamento não possui sinal para pagamento online.
              </div>
            )}
            {modalError ? <div className={styles.modalError}>{modalError}</div> : null}
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cta}
                onClick={handlePayDeposit}
                disabled={!depositAvailable || isProcessingPayment}
              >
                {isProcessingPayment ? 'Abrindo checkout…' : 'Pagar sinal agora'}
              </button>
              <button
                type="button"
                className={`${styles.cta} ${styles.payLaterCta}`}
                onClick={handlePayLater}
                disabled={isProcessingPayment}
              >
                Pagar depois
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div
        className={styles.noticeModal}
        data-open={isPayLaterNoticeOpen ? 'true' : 'false'}
        aria-hidden={isPayLaterNoticeOpen ? 'false' : 'true'}
      >
        <div className={styles.noticeBackdrop} aria-hidden="true" />
        <div
          className={styles.noticeContent}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-later-notice-title"
        >
          <div className={styles.noticeIcon} aria-hidden="true">
            ⏳
          </div>
          <h2 id="pay-later-notice-title" className={styles.noticeTitle}>
            Aguardando pagamento
          </h2>
          <p className={styles.noticeText}>
            Seu agendamento foi criado com sucesso!
            <br />
            <br />
            O <strong>pagamento do sinal</strong> deve ser realizado em até <strong>2 horas</strong>{' '}
            para que o horário seja reservado.
            <br />
            <br />
            Após esse prazo, o agendamento será <strong>cancelado automaticamente</strong>.
          </p>
          <button
            type="button"
            className={styles.noticeButton}
            onClick={handleConfirmPayLaterNotice}
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  )
}
