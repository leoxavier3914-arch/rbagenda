'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

import {
  AdminCustomizationPanel,
  DateSelectionSection,
  PayLaterNotice,
  ProcedimentoWrapper,
  SummaryModal,
  TechniqueSelectionSection,
  TimeSelectionSection,
  TypeSelectionSection,
} from './@components'

import { supabase } from '@/lib/db'
import {
  DEFAULT_FALLBACK_BUFFER_MINUTES,
  DEFAULT_SLOT_TEMPLATE,
  DEFAULT_TIMEZONE,
  buildAvailabilityData,
  formatDateToIsoDay,
} from '@/lib/availability'
import { resolveFinalServiceValues } from '@/lib/servicePricing'
import { stripePromise } from '@/lib/stripeClient'
import { useLavaLamp } from '@/components/LavaLampProvider'
import { useClientPageReady } from '@/hooks/useClientPageReady'
import { useClientSessionGuard } from '@/hooks/useClientSessionGuard'
import { useClientAvailability } from '@/hooks/useClientAvailability'
import type {
  ServiceTechnique,
  ServiceTypeAssignment,
  SummarySnapshot,
  TechniqueCatalogEntry,
} from './types'
import styles from './procedimento.module.css'

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min'
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (remaining > 0) parts.push(`${remaining} min`)
  return parts.join(' ')
}

function combineDateAndTime(dateIso: string, time: string, timeZone = DEFAULT_TIMEZONE) {
  const [hour, minute] = time.split(':')

  if (!dateIso || typeof hour === 'undefined' || typeof minute === 'undefined') {
    return null
  }

  const normalizedHour = hour.padStart(2, '0')
  const normalizedMinute = minute.padStart(2, '0')
  const candidate = fromZonedTime(`${dateIso}T${normalizedHour}:${normalizedMinute}:00`, timeZone)

  if (Number.isNaN(candidate.getTime())) {
    return null
  }

  return candidate
}

const FALLBACK_BUFFER_MINUTES = DEFAULT_FALLBACK_BUFFER_MINUTES
const WORK_DAY_END = '18:00'

export default function ProcedimentoPage() {
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [techniqueCatalog, setTechniqueCatalog] = useState<TechniqueCatalogEntry[]>([])
  const [catalogStatus, setCatalogStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null)
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [summarySnapshot, setSummarySnapshot] = useState<SummarySnapshot | null>(null)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [isPayLaterNoticeOpen, setIsPayLaterNoticeOpen] = useState(false)
  const [payLaterError, setPayLaterError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<
    { kind: 'success' | 'error'; text: string } | null
  >(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)

  const {
    availability: availabilitySnapshot,
    isLoadingAvailability,
    availabilityError,
  } = useClientAvailability({
    enabled: Boolean(userId),
    subscribe: true,
    channel: 'procedimento-appointments',
    fallbackBufferMinutes: FALLBACK_BUFFER_MINUTES,
    timezone: DEFAULT_TIMEZONE,
    errorMessage: 'Não foi possível carregar a disponibilidade. Tente novamente mais tarde.',
  })

  const router = useRouter()
  const { refreshPalette } = useLavaLamp()
  const heroReady = useClientPageReady()
  const { session, isReady: isSessionReady } = useClientSessionGuard()
  const slotsContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isSessionReady) return
    let active = true

    setUserId(session?.user?.id ?? null)

    if (!session?.user?.id) {
      setIsAdmin(false)
      return () => {
        active = false
      }
    }

    const loadProfile = async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!active) return

      if (profileError) {
        console.error('Erro ao carregar perfil', profileError)
        setIsAdmin(false)
        return
      }

      const role = profile?.role
      const isAdminRole = role === 'admin' || role === 'adminsuper' || role === 'adminmaster'
      setIsAdmin(isAdminRole)
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [isSessionReady, session?.user?.id])

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      setCatalogStatus('loading')
      setCatalogError(null)

      try {
        const { data, error } = await supabase
          .from('service_types')
          .select(
            `id, name, slug, description, active, order_index, base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min, assignments:service_type_assignments(use_service_defaults, override_duration_min, override_price_cents, override_deposit_cents, override_buffer_min, services:services(id, name, slug, active))`,
          )
          .eq('active', true)
          .order('order_index', { ascending: true, nullsFirst: true })
          .order('name', { ascending: true })

        if (error) throw error
        if (!active) return

        const normalized = (data ?? []).map((entry) => {
          const assignments = Array.isArray(entry.assignments)
            ? (entry.assignments as ServiceTypeAssignment[])
            : entry.assignments
            ? ([entry.assignments] as ServiceTypeAssignment[])
            : ([] as ServiceTypeAssignment[])

          const baseValues = {
            base_duration_min: entry.base_duration_min ?? 0,
            base_price_cents: entry.base_price_cents ?? 0,
            base_deposit_cents: entry.base_deposit_cents ?? 0,
            base_buffer_min: entry.base_buffer_min ?? 0,
          }

          const serviceMap = new Map<string, ServiceTechnique>()
          assignments.forEach((assignment: ServiceTypeAssignment) => {
            const related = assignment?.services
            const relatedArray = Array.isArray(related)
              ? related
              : related
              ? [related]
              : []

            relatedArray.forEach((svc) => {
              if (!svc || typeof svc.id !== 'string') return
              if (svc.active === false) return
              if (serviceMap.has(svc.id)) return

              const finalValues = resolveFinalServiceValues(baseValues, {
                use_service_defaults: assignment?.use_service_defaults ?? true,
                override_duration_min: assignment?.override_duration_min ?? null,
                override_price_cents: assignment?.override_price_cents ?? null,
                override_deposit_cents: assignment?.override_deposit_cents ?? null,
                override_buffer_min: assignment?.override_buffer_min ?? null,
              })

              if (!Number.isFinite(finalValues.duration_min) || finalValues.duration_min <= 0) return

              serviceMap.set(svc.id, {
                id: svc.id,
                name: svc.name ?? 'Opção',
                slug: svc.slug ?? null,
                duration_min: Math.max(0, Math.round(finalValues.duration_min)),
                price_cents: Math.max(0, Math.round(finalValues.price_cents)),
                deposit_cents: Math.max(0, Math.round(finalValues.deposit_cents)),
                buffer_min: Math.max(0, Math.round(finalValues.buffer_min)),
                active: svc.active,
              })
            })
          })

          const services = Array.from(serviceMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

          const orderIndex = normalizeNumber(entry.order_index)

          return {
            id: entry.id,
            name: entry.name ?? 'Serviço',
            slug: entry.slug ?? null,
            description: entry.description ?? null,
            order_index: orderIndex !== null ? Math.round(orderIndex) : 0,
            active: entry.active !== false,
            services,
          } satisfies TechniqueCatalogEntry
        })

        normalized.sort(
          (a, b) =>
            a.order_index - b.order_index || a.name.localeCompare(b.name, 'pt-BR'),
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

  const availableProcedures = useMemo(
    () => techniqueCatalog.filter((procedure) => procedure.services.length > 0),
    [techniqueCatalog],
  )

  useEffect(() => {
    if (catalogStatus !== 'ready') return

    if (availableProcedures.length === 0) {
      setSelectedProcedureId(null)
      return
    }

    if (selectedProcedureId && !availableProcedures.some((procedure) => procedure.id === selectedProcedureId)) {
      setSelectedProcedureId(null)
    }
  }, [availableProcedures, catalogStatus, selectedProcedureId])

  const selectedProcedure = useMemo(
    () => availableProcedures.find((procedure) => procedure.id === selectedProcedureId) ?? null,
    [availableProcedures, selectedProcedureId],
  )

  useEffect(() => {
    if (!selectedProcedure) {
      if (selectedTechniqueId !== null) {
        setSelectedTechniqueId(null)
      }
      return
    }

    const activeTechniques = selectedProcedure.services
    if (activeTechniques.length === 0) {
      if (selectedTechniqueId !== null) {
        setSelectedTechniqueId(null)
      }
      return
    }

    if (selectedTechniqueId && !activeTechniques.some((tech) => tech.id === selectedTechniqueId)) {
      setSelectedTechniqueId(null)
    }
  }, [selectedProcedure, selectedTechniqueId])

  const selectedTechnique = useMemo(() => {
    if (!selectedTechniqueId || !selectedProcedure) return null
    return selectedProcedure.services.find((tech) => tech.id === selectedTechniqueId) ?? null
  }, [selectedProcedure, selectedTechniqueId])

  useEffect(() => {
    setSelectedSlot(null)
  }, [selectedTechniqueId])

  const availability = useMemo(
    () =>
      availabilitySnapshot ??
      buildAvailabilityData([], userId, {
        fallbackBufferMinutes: FALLBACK_BUFFER_MINUTES,
        timezone: DEFAULT_TIMEZONE,
      }),
    [availabilitySnapshot, userId],
  )

  const monthTitle = useMemo(() => {
    const localeTitle = new Date(year, month, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
    return localeTitle.charAt(0).toUpperCase() + localeTitle.slice(1)
  }, [month, year])

  const serviceBufferMinutes = useMemo(() => {
    const normalized = normalizeNumber(selectedTechnique?.buffer_min)
    const fallback = FALLBACK_BUFFER_MINUTES
    if (normalized === null) return Math.max(0, fallback)
    return Math.max(0, Math.round(normalized))
  }, [selectedTechnique])

  const canInteract =
    catalogStatus === 'ready' &&
    !!selectedProcedure &&
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
      const iso = formatDateToIsoDay(date, DEFAULT_TIMEZONE)

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
    if (!selectedDate || !canInteract || !selectedTechnique) return []

    const durationMinutes = selectedTechnique.duration_min
    if (!durationMinutes) return []

    const template = availability.daySlots[selectedDate] ?? DEFAULT_SLOT_TEMPLATE

    const closing = combineDateAndTime(selectedDate, WORK_DAY_END)
    if (!closing) return []

    const todayIso = formatInTimeZone(now, DEFAULT_TIMEZONE, 'yyyy-MM-dd')

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
    selectedTechnique,
    serviceBufferMinutes,
  ])

  useEffect(() => {
    if (!selectedSlot) return
    if (!slots.includes(selectedSlot)) {
      setSelectedSlot(null)
    }
  }, [selectedSlot, slots])

  const goToPreviousMonth = useCallback(() => {
    const previous = new Date(year, month - 1, 1)
    setYear(previous.getFullYear())
    setMonth(previous.getMonth())
  }, [month, year])

  const goToNextMonth = useCallback(() => {
    const next = new Date(year, month + 1, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }, [month, year])

  const handleProcedureSelect = useCallback(
    (procedureId: string) => {
      if (procedureId === selectedProcedureId) return
      setSelectedProcedureId(procedureId)
      setSelectedTechniqueId(null)
      setSelectedDate(null)
      setSelectedSlot(null)
    },
    [selectedProcedureId],
  )

  const handleTechniqueSelect = useCallback((techniqueId: string) => {
    if (techniqueId === selectedTechniqueId) return
    setSelectedTechniqueId(techniqueId)
    setSelectedDate(null)
    setSelectedSlot(null)
  }, [selectedTechniqueId])

  const handleDaySelect = useCallback(
    (dayIso: string, disabled: boolean) => {
      if (disabled || !canInteract) return
      setSelectedDate(dayIso)
      setSelectedSlot(null)
    },
    [canInteract],
  )

  const handleSlotSelect = useCallback(
    (slotValue: string, disabled: boolean) => {
      if (disabled) return
      setSelectedSlot(slotValue)
    },
    [],
  )

  useEffect(() => {
    if (currentStep > 1 && !selectedProcedureId) {
      setCurrentStep(1)
      return
    }
    if (currentStep > 2 && !selectedTechniqueId) {
      setCurrentStep(2)
      return
    }
    if (currentStep > 3 && !selectedDate) {
      setCurrentStep(3)
    }
  }, [currentStep, selectedDate, selectedProcedureId, selectedTechniqueId])

  const summaryData = useMemo(() => {
    if (!selectedProcedure || !selectedTechnique || !selectedDate || !selectedSlot) return null

    const priceValue = Number.isFinite(selectedTechnique.price_cents)
      ? selectedTechnique.price_cents / 100
      : 0
    const priceLabel = priceValue > 0
      ? priceValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'R$ 0,00'

    const depositCents = Number.isFinite(selectedTechnique.deposit_cents)
      ? Math.max(0, selectedTechnique.deposit_cents)
      : 0
    const depositLabel = depositCents > 0
      ? (depositCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'Sem sinal'

    const dateLabel = new Date(selectedDate).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    return {
      typeId: selectedProcedure.id,
      typeName: selectedProcedure.name,
      techniqueId: selectedTechnique.id,
      techniqueName: selectedTechnique.name,
      priceLabel,
      priceCents: Number.isFinite(selectedTechnique.price_cents)
        ? selectedTechnique.price_cents
        : 0,
      depositLabel,
      depositCents,
      durationLabel: formatDuration(selectedTechnique.duration_min),
      dateLabel,
      timeLabel: selectedSlot,
      payload: {
        typeId: selectedProcedure.id,
        serviceId: selectedTechnique.id,
        date: selectedDate,
        slot: selectedSlot,
      },
    } satisfies SummarySnapshot
  }, [selectedDate, selectedProcedure, selectedSlot, selectedTechnique])

  useEffect(() => {
    setAppointmentId(null)
    setSummarySnapshot(null)
    setModalError(null)
    setPayLaterError(null)
    setIsSummaryModalOpen(false)
    setIsProcessingPayment(false)
    setActionMessage(null)
    setIsPayLaterNoticeOpen(false)
  }, [selectedProcedureId, selectedTechniqueId, selectedDate, selectedSlot])

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

  const closeSummaryModal = useCallback(() => {
    setIsSummaryModalOpen(false)
    setModalError(null)
    setPayLaterError(null)
  }, [])

  const ensureAppointmentCreated = useCallback(async () => {
    if (!summaryData) {
      throw new Error('Selecione o serviço, técnica, data e horário antes de continuar.')
    }

    if (appointmentId) return appointmentId

    const currentSummary = summaryData
    setIsCreatingAppointment(true)
    setActionMessage(null)
    setPayLaterError(null)

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
      return newAppointmentId
    } catch (error) {
      console.error('Erro ao criar agendamento', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível criar o agendamento. Tente novamente.'
      setActionMessage({ kind: 'error', text: message })
      throw new Error(message)
    } finally {
      setIsCreatingAppointment(false)
    }
  }, [appointmentId, ensureSession, summaryData])

  const handleContinue = useCallback(() => {
    if (!summaryData) return

    setModalError(null)
    setPayLaterError(null)
    setSummarySnapshot(summaryData)
    setIsSummaryModalOpen(true)
  }, [summaryData])

  const handlePayDeposit = useCallback(async () => {
    if (!summarySnapshot || summarySnapshot.depositCents <= 0) {
      setModalError('Este agendamento não possui sinal disponível para pagamento.')
      return
    }

    if (!stripePromise) {
      setModalError('Checkout indisponível. Verifique a configuração do Stripe.')
      return
    }

    setModalError(null)
    setPayLaterError(null)
    setIsProcessingPayment(true)

    try {
      const ensuredAppointmentId = await ensureAppointmentCreated()
      const session = await ensureSession()

      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ appointment_id: ensuredAppointmentId, mode: 'deposit' }),
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

      setIsSummaryModalOpen(false)
      closeSummaryModal()
      router.push(
        `/checkout?client_secret=${encodeURIComponent(clientSecret)}&appointment_id=${encodeURIComponent(ensuredAppointmentId)}`,
      )
    } catch (error) {
      console.error('Erro ao iniciar o checkout', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Erro inesperado ao iniciar o checkout.'
      setModalError(message)
    } finally {
      setIsProcessingPayment(false)
    }
  }, [closeSummaryModal, ensureAppointmentCreated, ensureSession, router, summarySnapshot])

  const handlePayLater = useCallback(() => {
    setIsSummaryModalOpen(false)
    setPayLaterError(null)
    setIsPayLaterNoticeOpen(true)
  }, [])

  const handleConfirmPayLaterNotice = useCallback(async () => {
    setPayLaterError(null)
    try {
      await ensureAppointmentCreated()
      setIsPayLaterNoticeOpen(false)
      router.push('/agendamentos')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível criar o agendamento. Tente novamente.'
      setPayLaterError(message)
    }
  }, [ensureAppointmentCreated, router])

  const handleCancelPayLaterNotice = useCallback(() => {
    setIsPayLaterNoticeOpen(false)
    setPayLaterError(null)
    setIsSummaryModalOpen(true)
  }, [])

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
        handleCancelPayLaterNotice()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleCancelPayLaterNotice, isPayLaterNoticeOpen])

  const continueButtonLabel = isCreatingAppointment ? 'Salvando agendamento…' : 'Ver resumo'
  const continueButtonDisabled = !summaryData || isCreatingAppointment
  const depositAvailable = Boolean(summarySnapshot && summarySnapshot.depositCents > 0)
  const totalSteps = 4
  const stepLabel = `Etapa ${currentStep} de ${totalSteps}`
  const stepProgress = `${Math.round((currentStep / totalSteps) * 100)}%`
  const stepProgressNode = (
    <div className={styles.progressTrack} role="presentation">
      <span className={styles.progressFill} style={{ width: stepProgress }} />
    </div>
  )
  const stepContinueDisabled = (() => {
    if (currentStep === 1) return !selectedProcedureId || catalogStatus !== 'ready'
    if (currentStep === 2) return !selectedTechniqueId
    if (currentStep === 3) return !selectedDate
    return continueButtonDisabled
  })()
  const stepContinueLabel = currentStep === 4 ? continueButtonLabel : 'Continuar'

  const handleStepContinue = useCallback(() => {
    if (currentStep === 1 && (!selectedProcedureId || catalogStatus !== 'ready')) return
    if (currentStep === 2 && !selectedTechniqueId) return
    if (currentStep === 3 && !selectedDate) return
    if (currentStep === 4) {
      handleContinue()
      return
    }
    setCurrentStep((previous) => Math.min(totalSteps, previous + 1))
  }, [catalogStatus, currentStep, handleContinue, selectedDate, selectedProcedureId, selectedTechniqueId])

  return (
    <ProcedimentoWrapper heroReady={heroReady}>
      <div className={styles.wizard}>
        <div className={styles.wizardBody}>
          <div className={styles.stack}>
            {currentStep === 1 ? (
              <TypeSelectionSection
                catalogError={catalogError}
                catalogStatus={catalogStatus}
                availableProcedures={availableProcedures}
                selectedProcedureId={selectedProcedureId}
                onSelect={handleProcedureSelect}
                stepLabel={stepLabel}
                stepProgress={stepProgressNode}
              />
            ) : null}

            {currentStep === 2 ? (
              <TechniqueSelectionSection
                catalogStatus={catalogStatus}
                selectedProcedure={selectedProcedure}
                selectedTechniqueId={selectedTechniqueId}
                onTechniqueSelect={handleTechniqueSelect}
                stepLabel={stepLabel}
                stepProgress={stepProgressNode}
              />
            ) : null}

            {currentStep === 3 ? (
              <DateSelectionSection
                availabilityError={availabilityError}
                isLoadingAvailability={isLoadingAvailability}
                calendarHeaderDays={calendarHeaderDays}
                calendarDays={calendarDays}
                monthTitle={monthTitle}
                selectedTechnique={selectedTechnique}
                selectedDate={selectedDate}
                onPreviousMonth={goToPreviousMonth}
                onNextMonth={goToNextMonth}
                onDaySelect={handleDaySelect}
                stepLabel={stepLabel}
                stepProgress={stepProgressNode}
              />
            ) : null}

            {currentStep === 4 ? (
              <TimeSelectionSection
                slotsContainerRef={slotsContainerRef}
                selectedDate={selectedDate}
                slots={slots}
                bookedSlots={bookedSlots}
                selectedSlot={selectedSlot}
                actionMessage={actionMessage}
                onSlotSelect={handleSlotSelect}
                stepLabel={stepLabel}
                stepProgress={stepProgressNode}
              />
            ) : null}

            <div className={styles.wizardFooter}>
              <button
                type="button"
                className={styles.continueButton}
                onClick={handleStepContinue}
                disabled={stepContinueDisabled}
              >
                {stepContinueLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      <SummaryModal
        summarySnapshot={summarySnapshot}
        isOpen={isSummaryModalOpen}
        modalError={modalError}
        isProcessingPayment={isProcessingPayment}
        depositAvailable={depositAvailable}
        onClose={closeSummaryModal}
        onPayDeposit={handlePayDeposit}
        onPayLater={handlePayLater}
      />

      <PayLaterNotice
        isOpen={isPayLaterNoticeOpen}
        isSubmitting={isCreatingAppointment}
        errorMessage={payLaterError}
        onConfirm={handleConfirmPayLaterNotice}
        onCancel={handleCancelPayLaterNotice}
      />

      {isAdmin ? <AdminCustomizationPanel refreshPalette={refreshPalette} /> : null}
    </ProcedimentoWrapper>
  )
}
