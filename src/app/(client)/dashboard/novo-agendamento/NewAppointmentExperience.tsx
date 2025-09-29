'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

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

type ExampleData = {
  availableDays: Set<string>
  partiallyBookedDays: Set<string>
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
  const partiallyBookedDays = new Set<string>()
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
        } else if (entry.times.size > 0) {
          partiallyBookedDays.add(iso)
        } else {
          availableDays.add(iso)
        }
      }
    } else {
      availableDays.add(iso)
    }
  }

  return {
    availableDays,
    partiallyBookedDays,
    bookedDays,
    myDays,
    daySlots,
    bookedSlots,
    busyIntervals,
  }
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
  const [showAllTechniques, setShowAllTechniques] = useState(false)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [appointments, setAppointments] = useState<LoadedAppointment[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [isPayLaterNoticeOpen, setIsPayLaterNoticeOpen] = useState(false)
  const [payLaterError, setPayLaterError] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [createdAppointmentId, setCreatedAppointmentId] = useState<string | null>(null)
  const payNowButtonRef = useRef<HTMLButtonElement | null>(null)
  const payLaterNoticeButtonRef = useRef<HTMLButtonElement | null>(null)

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

    if (!selectedTypeId || !availableTypes.some((type) => type.id === selectedTypeId)) {
      setSelectedTypeId(availableTypes[0].id)
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
    setCreatedAppointmentId(null)
    setSummaryError(null)
  }, [selectedDate, selectedSlot, selectedServiceId, selectedTypeId])

  useEffect(() => {
    if (!isSummaryOpen) return
    if (typeof document === 'undefined') return

    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousOverflow
    }
  }, [isSummaryOpen])

  useEffect(() => {
    if (!isSummaryOpen) return
    payNowButtonRef.current?.focus()
  }, [isSummaryOpen])

  useEffect(() => {
    if (!isPayLaterNoticeOpen) return
    payLaterNoticeButtonRef.current?.focus()
  }, [isPayLaterNoticeOpen])

  useEffect(() => {
    if (!isPayLaterNoticeOpen || isSummaryOpen) return
    if (typeof document === 'undefined') return

    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousOverflow
    }
  }, [isPayLaterNoticeOpen, isSummaryOpen])

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
        escolha: 'Selecione uma técnica e um tipo de serviço',
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
      escolha: `Tipo: ${selectedService.name} • Técnica: ${selectedType.name}`,
      quando: `Data: ${formatIsoDateToBR(selectedDate)} • Horário: ${selectedSlot ?? '—'}`,
    }
  }, [selectedDate, selectedService, selectedSlot, selectedType])

  const summaryProcedure = useMemo(() => {
    if (selectedService && selectedType) {
      return `${selectedService.name} • ${selectedType.name}`
    }

    if (selectedService) return selectedService.name
    if (selectedType) return selectedType.name
    return '—'
  }, [selectedService, selectedType])

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
        day,
        isDisabled,
        state: status,
      })
    }

    return { startWeekday, dayEntries }
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
    setCreatedAppointmentId(null)
  }

  function handleSlotSelect(slotValue: string, disabled: boolean) {
    if (disabled || !canInteract) return
    setSelectedSlot(slotValue)
    setSubmitError(null)
    setSubmitSuccess(null)
    setCreatedAppointmentId(null)
  }

  function handleTypeSelect(typeId: string) {
    if (typeId === selectedTypeId) return
    setSelectedTypeId(typeId)
    setSubmitError(null)
    setSubmitSuccess(null)
    setCreatedAppointmentId(null)
  }

  function handleTechniqueSelect(serviceId: string) {
    if (serviceId === selectedServiceId) return
    setSelectedServiceId(serviceId)
    setSubmitError(null)
    setSubmitSuccess(null)
    setCreatedAppointmentId(null)
  }

  function handleContinue() {
    if (!isReadyToContinue) return
    setSubmitError(null)
    setSubmitSuccess(null)
    setSummaryError(null)
    setIsSummaryOpen(true)
  }

  async function ensureSession() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError

    const session = sessionData.session
    if (!session?.access_token || !session.user?.id) {
      window.location.href = '/login'
      throw new Error('Sessão expirada. Faça login novamente.')
    }

    return session
  }

  async function ensureAppointment(session: Session) {
    if (!selectedDate || !selectedSlot || !selectedService) {
      throw new Error('Selecione uma data e horário válidos.')
    }

    if (createdAppointmentId) {
      return createdAppointmentId
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
      let errorMessage = 'Não foi possível criar o agendamento. Tente novamente.'
      try {
        const body = await response.json()
        if (body && typeof body.error === 'string') {
          errorMessage = body.error
        }
      } catch (err) {
        console.error('Falha ao analisar resposta de erro do agendamento', err)
      }
      throw new Error(errorMessage)
    }

    const payload = await response.json().catch(() => null)
    const appointmentId = (payload?.appointment_id as string | undefined) ?? null

    if (!appointmentId) {
      throw new Error('Resposta inválida ao criar o agendamento. Tente novamente.')
    }

    setCreatedAppointmentId(appointmentId)
    return appointmentId
  }

  async function handlePayNow() {
    if (!isReadyToContinue || isSubmitting) return

    setSummaryError(null)
    setIsSubmitting(true)

    try {
      const session = await ensureSession()
      const appointmentId = await ensureAppointment(session)

      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ appointment_id: appointmentId, mode: 'deposit' }),
      })

      if (!response.ok) {
        let errorMessage = 'Não foi possível iniciar o checkout. Tente novamente.'
        try {
          const body = await response.json()
          if (body && typeof body.error === 'string') {
            errorMessage = body.error
          }
        } catch (err) {
          console.error('Falha ao analisar resposta do pagamento', err)
        }
        throw new Error(errorMessage)
      }

      const data = await response.json().catch(() => null)
      const clientSecret = typeof data?.client_secret === 'string' ? data.client_secret : null

      if (clientSecret) {
        setIsSummaryOpen(false)
        router.push(
          `/checkout?client_secret=${encodeURIComponent(clientSecret)}&appointment_id=${encodeURIComponent(appointmentId)}`,
        )
      } else {
        throw new Error('Resposta inválida do servidor ao iniciar o checkout.')
      }
    } catch (error) {
      console.error('Erro ao iniciar pagamento do agendamento', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Erro inesperado ao iniciar o checkout. Tente novamente.'
      setSummaryError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handlePayLaterClick() {
    if (isSubmitting) return

    setSummaryError(null)
    setPayLaterError(null)
    setIsPayLaterNoticeOpen(true)
  }

  async function handlePayLaterConfirm() {
    if (isSubmitting) return

    setSummaryError(null)
    setPayLaterError(null)
    setIsSubmitting(true)

    try {
      const session = await ensureSession()
      const appointmentId = await ensureAppointment(session)
      setIsSummaryOpen(false)
      setIsPayLaterNoticeOpen(false)
      router.push(`/dashboard/agendamentos?novo=${encodeURIComponent(appointmentId)}`)
    } catch (error) {
      console.error('Erro ao finalizar agendamento sem pagamento', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Erro inesperado ao concluir o agendamento. Tente novamente.'
      setPayLaterError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <h1 className={styles.title}>Novo agendamento</h1>
        <p className={styles.subtitle}>
          Escolha a técnica e o tipo de serviço, além da data e horário. O preço, tempo e sinal atualizam automaticamente.
        </p>

        <section className={`${styles.card} ${styles.section}`} id="tecnica-card">
          <div className={`${styles.label} ${styles.labelCentered}`}>Tipo</div>
          {catalogStatus === 'ready' && selectedType && selectedType.services.length > 0 ? (
            <>
              <div
                className={`${styles.pills} ${styles.techniquePills}`}
                role="tablist"
                aria-label="Tipo"
              >
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
              Selecione uma técnica para ver os serviços disponíveis.
            </div>
          ) : null}
        </section>

        <section className={`${styles.card} ${styles.section}`} id="tipo-card">
          <div className={`${styles.label} ${styles.labelCentered}`}>Técnica</div>
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
              aria-label="Técnica"
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

        <section className={`${styles.card} ${styles.section}`} id="extras-card">
          <div className={`${styles.label} ${styles.labelCentered}`}>Detalhes do serviço</div>
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
      <div
        className={styles.modal}
        data-open={isSummaryOpen ? 'true' : 'false'}
        aria-hidden={isSummaryOpen ? 'false' : 'true'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-title"
      >
        <div className={styles.modalBackdrop} aria-hidden="true" />
        <div className={styles.modalContent} role="document">
          <h2 className={styles.modalTitle} id="summary-title">
            Resumo do agendamento
          </h2>
          <div className={styles.modalBody}>
            <div className={styles.modalLine}>
              <span>Procedimento</span>
              <strong>{summaryProcedure}</strong>
            </div>
            <div className={styles.modalLine}>
              <span>Data</span>
              <strong>{selectedDate ? formatIsoDateToBR(selectedDate) : '—'}</strong>
            </div>
            <div className={styles.modalLine}>
              <span>Horário</span>
              <strong>{selectedSlot ?? '—'}</strong>
            </div>
            <div className={styles.modalLine}>
              <span>Valor total</span>
              <strong>R$ {toBRLCurrency(computed.total)}</strong>
            </div>
            <div className={`${styles.modalLine} ${styles.modalLineHighlight}`}>
              <span>Valor do sinal (online)</span>
              <strong>R$ {toBRLCurrency(computed.deposit)}</strong>
            </div>
            {summaryError && <div className={styles.modalError}>{summaryError}</div>}
          </div>
          <div className={styles.modalFooter}>
            <button
              ref={payNowButtonRef}
              type="button"
              className={styles.cta}
              disabled={isSubmitting}
              onClick={() => {
                void handlePayNow()
              }}
            >
              {isSubmitting ? 'Processando…' : 'Pagar agora'}
            </button>
            <button
              type="button"
              className={`${styles.cta} ${styles.payLaterCta}`}
              disabled={isSubmitting}
              onClick={handlePayLaterClick}
            >
              Pagar depois
            </button>
          </div>
        </div>
      </div>
      <div
        className={styles.noticeModal}
        data-open={isPayLaterNoticeOpen ? 'true' : 'false'}
        aria-hidden={isPayLaterNoticeOpen ? 'false' : 'true'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-later-notice-title"
      >
        <div className={styles.noticeBackdrop} aria-hidden="true" />
        <div className={styles.noticeContent} role="document">
          <div className={styles.noticeIcon} aria-hidden="true">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1f8a70"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <h2 className={styles.noticeTitle} id="pay-later-notice-title">
            Agendamento criado!
          </h2>
          <p className={styles.noticeText}>
            O <strong>sinal deve ser pago em até 2 horas</strong> para garantir sua reserva. Após esse prazo, o
            horário será <strong>cancelado automaticamente</strong> e liberado para novos agendamentos.
          </p>
          {payLaterError && <div className={styles.noticeError}>{payLaterError}</div>}
          <button
            ref={payLaterNoticeButtonRef}
            type="button"
            className={styles.noticeButton}
            disabled={isSubmitting}
            onClick={() => {
              void handlePayLaterConfirm()
            }}
          >
            {isSubmitting ? 'Processando…' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
