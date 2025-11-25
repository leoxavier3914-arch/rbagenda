'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/db'
import { stripePromise } from '@/lib/stripeClient'
import {
  buildAvailabilityData,
  DEFAULT_FALLBACK_BUFFER_MINUTES,
  DEFAULT_TIMEZONE,
  type AvailabilityAppointment,
} from '@/lib/availability'
import { PROCEDIMENTO_CSS } from '@/lib/procedimentoTheme'

import styles from './appointments.module.css'

const statusLabels = {
  pending: 'Pendente',
  reserved: 'Reservado',
  confirmed: 'Confirmado',
  canceled: 'Cancelado',
  completed: 'Finalizado',
} as const

type AppointmentStatus = keyof typeof statusLabels

const knownStatusKeys = new Set<AppointmentStatus>(Object.keys(statusLabels) as AppointmentStatus[])

type StatusCategory = 'ativos' | 'pendentes' | 'cancelados' | 'concluidos'

type SelectedStatusCategory = StatusCategory | null

const STATUS_FILTERS: Record<StatusCategory, AppointmentStatus[]> = {
  ativos: ['reserved', 'confirmed'],
  pendentes: ['pending'],
  cancelados: ['canceled'],
  concluidos: ['completed'],
}

const statusCards: Array<{ key: StatusCategory; title: string; description: string }> = [
  {
    key: 'ativos',
    title: 'Ativos',
    description: 'Horários confirmados ou reservados.',
  },
  {
    key: 'pendentes',
    title: 'Pendentes',
    description: 'Agendamentos aguardando confirmação.',
  },
  {
    key: 'cancelados',
    title: 'Cancelados',
    description: 'Horários cancelados ou liberados.',
  },
  {
    key: 'concluidos',
    title: 'Concluídos',
    description: 'Atendimentos já finalizados.',
  },
]

const statusEmptyMessages: Record<StatusCategory, string> = {
  ativos: 'Você ainda não tem agendamentos ativos.',
  pendentes: 'Você ainda não tem agendamentos pendentes.',
  cancelados: 'Você ainda não tem agendamentos cancelados.',
  concluidos: 'Você ainda não tem agendamentos finalizados.',
}

const normalizeStatusValue = (status: string | null | undefined): AppointmentStatus => {
  if (typeof status !== 'string') return 'pending'
  const trimmed = status.trim()
  if (!trimmed) return 'pending'
  const normalized = trimmed.toLowerCase()
  if (knownStatusKeys.has(normalized as AppointmentStatus)) {
    return normalized as AppointmentStatus
  }
  return 'pending'
}

const CANCEL_THRESHOLD_HOURS = Number(process.env.NEXT_PUBLIC_DEFAULT_REMARCA_HOURS ?? 24)

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const toCurrency = (value: number) => currencyFormatter.format(value)

const parseNumeric = (value: number | string | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const toIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDate = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const formatTime = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const hoursUntil = (iso: string) => {
  const starts = new Date(iso).getTime()
  if (!Number.isFinite(starts)) return 0
  return (starts - Date.now()) / 3_600_000
}

type Rgb = { r: number; g: number; b: number }

const hexToRgb = (hex: string): Rgb => {
  const raw = hex.replace('#', '')
  const normalized = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw
  const value = parseInt(normalized, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

const mixHexColors = (colorA: string, colorB: string, ratio: number): string => {
  const a = hexToRgb(colorA)
  const b = hexToRgb(colorB)
  const mix = (channelA: number, channelB: number) => Math.round(channelA + (channelB - channelA) * ratio)
  return `#${[mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

type ServiceTypeShape = { id?: string | null; name?: string | null } | null

type ServiceAssignmentShape = {
  service_types?: ServiceTypeShape | ServiceTypeShape[] | null
} | null

type ServiceShape = {
  id?: string | null
  name?: string | null
  service_type_assignments?: ServiceAssignmentShape | ServiceAssignmentShape[] | null
} | null

type AppointmentRecord = {
  id: string
  starts_at: string
  ends_at: string | null
  status: AppointmentStatus
  total_cents: number | null
  deposit_cents: number | null
  valor_sinal: number | string | null
  preco_total: number | string | null
  services?: ServiceShape | ServiceShape[]
  service_id?: string | null
  service_type_id?: string | null
  service_type?: ServiceTypeShape | ServiceTypeShape[] | null
}

type AppointmentTotalsRecord = {
  appointment_id: string
  paid_cents: number | string | null
}

type NormalizedAppointment = {
  id: string
  serviceId: string | null
  serviceTypeId: string | null
  startsAt: string
  endsAt: string | null
  status: AppointmentStatus
  serviceType: string
  serviceTechnique: string | null
  totalValue: number
  depositValue: number
  paidValue: number
}

type CancelDialogState = {
  variant: 'standard' | 'penalty'
  appointment: NormalizedAppointment
} | null

type SuccessDialogState = {
  title: string
  message: string
} | null

type SlotsResponse = {
  slots?: string[]
}

type CalendarDayEntry = {
  iso: string
  day: string
  isDisabled: boolean
  state: 'available' | 'booked' | 'full' | 'mine' | 'disabled'
  isOutsideCurrentMonth: boolean
}

type AvailabilitySnapshot = ReturnType<typeof buildAvailabilityData>

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined) return []
  return [value]
}

const extractServiceDetails = (
  services?: ServiceShape | ServiceShape[],
  preferredServiceId?: string | null,
  preferredServiceTypeId?: string | null,
): { serviceName: string | null; techniqueName: string | null } => {
  const candidates = toArray(services).filter(
    (item): item is Exclude<ServiceShape, null> => Boolean(item) && typeof item === 'object',
  )
  const normalizedPreferredId = preferredServiceId?.toString().trim()
  const service =
    (normalizedPreferredId
      ? candidates.find((item) => item?.id?.toString().trim() === normalizedPreferredId)
      : undefined) ?? candidates[0]
  const rawServiceName = typeof service?.name === 'string' ? service.name.trim() : ''
  const assignments = toArray(service?.service_type_assignments)
  const normalizedPreferredTypeId = preferredServiceTypeId?.toString().trim()

  const techniqueCandidates = assignments
    .flatMap((assignment) => toArray(assignment?.service_types))
    .filter((type): type is Exclude<ServiceTypeShape, null> => Boolean(type) && typeof type === 'object')

  let techniqueName: string | null = null
  if (normalizedPreferredTypeId) {
    const match = techniqueCandidates.find(
      (type) => type?.id?.toString().trim() === normalizedPreferredTypeId,
    )
    if (match && typeof match.name === 'string') {
      const trimmed = match.name.trim()
      if (trimmed.length > 0) {
        techniqueName = trimmed
      }
    }
  }

  if (!techniqueName) {
    const fallback = techniqueCandidates
      .map((type) => (typeof type?.name === 'string' ? type.name.trim() : ''))
      .find((name) => name.length > 0)
    techniqueName = fallback && fallback.length > 0 ? fallback : null
  }

  return {
    serviceName: rawServiceName.length > 0 ? rawServiceName : null,
    techniqueName,
  }
}

const normalizeAppointment = (
  record: AppointmentRecord,
  totals: Map<string, number>,
): NormalizedAppointment => {
  const rawTotal = record.total_cents ?? Math.round(parseNumeric(record.preco_total) * 100)
  const rawDeposit = record.deposit_cents ?? Math.round(parseNumeric(record.valor_sinal) * 100)
  const rawPaid = totals.get(record.id) ?? 0

  const totalValue = Math.max(0, rawTotal) / 100
  const depositValue = Math.max(0, rawDeposit) / 100
  const paidValue = Math.max(0, rawPaid) / 100

  const normalizedServiceTypeId = record.service_type_id?.toString().trim() ?? null
  const storedTechniqueNameCandidates = toArray(record.service_type).filter(
    (item): item is Exclude<ServiceTypeShape, null> => Boolean(item) && typeof item === 'object',
  )

  let storedTechniqueName: string | null = null
  if (normalizedServiceTypeId) {
    const match = storedTechniqueNameCandidates.find(
      (item) => item?.id?.toString().trim() === normalizedServiceTypeId,
    )
    if (match && typeof match.name === 'string') {
      const trimmed = match.name.trim()
      if (trimmed.length > 0) {
        storedTechniqueName = trimmed
      }
    }
  }

  if (!storedTechniqueName) {
    const fallback = storedTechniqueNameCandidates
      .map((item) => (typeof item?.name === 'string' ? item.name.trim() : ''))
      .find((name) => name.length > 0)
    storedTechniqueName = fallback && fallback.length > 0 ? fallback : null
  }

  const { serviceName, techniqueName: fallbackTechniqueName } = extractServiceDetails(
    record.services,
    record.service_id ?? null,
    normalizedServiceTypeId,
  )

  const techniqueName = storedTechniqueName ?? fallbackTechniqueName

  const serviceType = serviceName ?? techniqueName ?? 'Serviço'
  const shouldShowTechniqueAsSecondary =
    Boolean(serviceName) &&
    Boolean(techniqueName) &&
    serviceName!.localeCompare(techniqueName!, 'pt-BR', { sensitivity: 'base' }) !== 0
  const serviceTechnique = shouldShowTechniqueAsSecondary ? techniqueName : null

  return {
    id: record.id,
    serviceId: record.service_id ?? null,
    serviceTypeId: record.service_type_id ?? null,
    startsAt: record.starts_at,
    endsAt: record.ends_at ?? null,
    status: normalizeStatusValue(record.status),
    serviceType,
    serviceTechnique,
    totalValue,
    depositValue,
    paidValue,
  }
}

const depositStatusLabel = (depositValue: number, paidValue: number) => {
  if (depositValue <= 0) return 'não necessário'
  const depositCents = Math.round(depositValue * 100)
  const paidCents = Math.round(paidValue * 100)
  if (paidCents >= depositCents) return 'pago'
  if (paidCents > 0) return 'parcial'
  return 'aguardando'
}

const canShowCancel = (status: AppointmentStatus) => !['canceled', 'completed'].includes(status)

const canShowPay = (appointment: NormalizedAppointment) => {
  if (appointment.depositValue <= 0) return false
  if (['canceled', 'completed'].includes(appointment.status)) return false
  return Math.round(appointment.paidValue * 100) < Math.round(appointment.depositValue * 100)
}

const canShowEdit = (appointment: NormalizedAppointment) => {
  if (!['pending', 'reserved'].includes(appointment.status)) return false
  return hoursUntil(appointment.startsAt) >= CANCEL_THRESHOLD_HOURS
}

type ConfirmCancelModalProps = {
  dialog: CancelDialogState
  onClose: () => void
  onConfirm: (dialog: CancelDialogState) => void
  isProcessing: boolean
  errorMessage: string | null
}

function ConfirmCancelModal({ dialog, onClose, onConfirm, isProcessing, errorMessage }: ConfirmCancelModalProps) {
  if (!dialog) return null

  const isPenalty = dialog.variant === 'penalty'
  const title = 'Cancelar agendamento?'
  const message = isPenalty
    ? 'Você pode cancelar este agendamento, mas o valor do sinal será perdido e não será reembolsado. Deseja continuar?'
    : 'Seu agendamento está dentro das regras de cancelamento. Deseja realmente cancelar seu horário?'

  return (
    <div className={styles.modal} aria-hidden="false">
      <div className={styles.modalBackdrop} onClick={isProcessing ? undefined : onClose} />
      <div className={`${styles.modalContent} ${styles.modalWarning}`} role="dialog" aria-modal="true">
        <div className={`${styles.iconWrap} ${isPenalty ? styles.iconWrapWarning : ''}`} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d1a13b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <circle cx="12" cy="16.5" r="1" />
          </svg>
        </div>
        <h2 className={styles.modalTitle}>{title}</h2>
        <p className={styles.modalText}>
          {message}
        </p>
        {errorMessage ? <div className={styles.modalError}>{errorMessage}</div> : null}
        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnYes}`} disabled={isProcessing} onClick={() => onConfirm(dialog)}>
            {isProcessing ? 'Cancelando…' : isPenalty ? 'Sim, cancela' : 'Sim, cancelar'}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnNo}`} disabled={isProcessing} onClick={onClose}>
            Não
          </button>
        </div>
      </div>
    </div>
  )
}

type SuccessModalProps = {
  dialog: SuccessDialogState
  onClose: () => void
}

function SuccessModal({ dialog, onClose }: SuccessModalProps) {
  if (!dialog) return null
  return (
    <div className={styles.modal} aria-hidden="false">
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={`${styles.modalContent} ${styles.modalSuccess}`} role="dialog" aria-modal="true">
        <div className={`${styles.iconWrap} ${styles.iconWrapSuccess}`} aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1f8a70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className={styles.modalTitle}>{dialog.title}</h2>
        <p className={styles.modalText}>{dialog.message}</p>
        <div className={styles.btnRowCenter}>
          <button type="button" className={`${styles.btn} ${styles.btnOk}`} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

type BlockedModalProps = {
  appointment: NormalizedAppointment | null
  onClose: () => void
}

function BlockedModal({ appointment, onClose }: BlockedModalProps) {
  if (!appointment) return null
  return (
    <div className={styles.modal} aria-hidden="false">
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={`${styles.modalContent} ${styles.modalWarning}`} role="dialog" aria-modal="true">
        <div className={`${styles.iconWrap} ${styles.iconWrapWarning}`} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d1a13b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <circle cx="12" cy="16.5" r="1" />
          </svg>
        </div>
        <h2 className={styles.modalTitle}>Alteração não permitida</h2>
        <p className={styles.modalText}>
          A alteração deste agendamento não pode ser realizada, pois faltam menos de 24h para o horário marcado.
        </p>
        <div className={styles.btnRowCenter}>
          <button type="button" className={`${styles.btn} ${styles.btnOk}`} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

type RescheduleModalProps = {
  appointment: NormalizedAppointment
  onClose: () => void
  onSuccess: (payload: { starts_at: string; ends_at: string | null }) => void
  ensureAuth: () => Promise<string | null>
}

type SlotOption = {
  iso: string
  label: string
  disabled: boolean
}

function RescheduleModal({ appointment, onClose, onSuccess, ensureAuth }: RescheduleModalProps) {
  const today = useMemo(() => {
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    return base
  }, [])

  const initialMonth = useMemo(() => {
    const start = new Date(appointment.startsAt)
    if (Number.isNaN(start.getTime())) {
      const fallback = new Date()
      fallback.setHours(0, 0, 0, 0)
      fallback.setDate(1)
      return fallback
    }
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    if (start < today) return new Date(today.getFullYear(), today.getMonth(), 1)
    return start
  }, [appointment.startsAt, today])

  const [currentMonth, setCurrentMonth] = useState<Date>(initialMonth)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slotOptions, setSlotOptions] = useState<SlotOption[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slotsMessage, setSlotsMessage] = useState<string>('Selecione um dia disponível para ver horários.')
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [availability, setAvailability] = useState<AvailabilitySnapshot | null>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const appointmentIsoDay = useMemo(() => appointment.startsAt.slice(0, 10), [appointment.startsAt])

  useEffect(() => {
    if (hoursUntil(appointment.startsAt) >= CANCEL_THRESHOLD_HOURS) {
      setSelectedDate(appointmentIsoDay)
      void loadSlots(appointmentIsoDay)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.id, appointmentIsoDay])

  useEffect(() => {
    let active = true

    const loadAvailability = async () => {
      if (!appointment.serviceId) {
        if (active) {
          setAvailability(null)
          setAvailabilityError(null)
          setIsLoadingAvailability(false)
        }
        return
      }

      if (active) {
        setIsLoadingAvailability(true)
        setAvailabilityError(null)
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        const session = sessionData.session
        if (!session?.user?.id) {
          window.location.href = '/login'
          return
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const limit = new Date(today)
        limit.setDate(limit.getDate() + 60)

        const { data, error } = await supabase
          .from('appointments')
          .select('id, scheduled_at, starts_at, ends_at, status, customer_id, services(buffer_min)')
          .eq('service_id', appointment.serviceId)
          .gte('starts_at', today.toISOString())
          .lte('starts_at', limit.toISOString())
          .in('status', ['pending', 'reserved', 'confirmed'])
          .returns<AvailabilityAppointment[]>()

        if (error) throw error

        if (!active) return

        const computed = buildAvailabilityData(data ?? [], session.user.id, {
          fallbackBufferMinutes: DEFAULT_FALLBACK_BUFFER_MINUTES,
          timezone: DEFAULT_TIMEZONE,
        })
        setAvailability(computed)
      } catch (err) {
        console.error('Failed to load availability for reschedule modal', err)
        if (active) {
          setAvailability(null)
          setAvailabilityError(
            'Não foi possível carregar a disponibilidade. Alguns dias podem não refletir a ocupação real.',
          )
        }
      } finally {
        if (active) {
          setIsLoadingAvailability(false)
        }
      }
    }

    void loadAvailability()

    return () => {
      active = false
    }
  }, [appointment.serviceId])

  const calendarHeaderDays = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const startWeekday = firstDay.getDay()
    const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
    return Array.from({ length: 7 }, (_, index) => labels[(startWeekday + index) % 7])
  }, [currentMonth])

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const totalDays = new Date(year, month + 1, 0).getDate()

    const dayEntries: CalendarDayEntry[] = []

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day)
      date.setHours(0, 0, 0, 0)
      const iso = toIsoDate(date)

      let state: CalendarDayEntry['state'] = 'available'
      if (availability) {
        if (availability.myDays.has(iso)) state = 'mine'
        else if (availability.bookedDays.has(iso)) state = 'full'
        else if (availability.partiallyBookedDays.has(iso)) state = 'booked'
        else if (availability.availableDays.has(iso)) state = 'available'
      }
      if (iso === appointmentIsoDay) {
        state = 'mine'
      }

      const isPastOrToday = date <= today
      const isDisabled = isPastOrToday || state === 'full'

      dayEntries.push({
        iso,
        day: String(day),
        isDisabled,
        state,
        isOutsideCurrentMonth: false,
      })
    }

    const trailingSpacers = (7 - (dayEntries.length % 7)) % 7
    for (let index = 1; index <= trailingSpacers; index += 1) {
      dayEntries.push({
        iso: `trailing-${year}-${month}-${index}`,
        day: '',
        isDisabled: true,
        state: 'disabled',
        isOutsideCurrentMonth: true,
      })
    }

    return { dayEntries }
  }, [appointmentIsoDay, availability, currentMonth, today])

  async function loadSlots(iso: string) {
    if (!appointment.serviceId) {
      setErrorMessage('Este agendamento não possui serviço associado para remarcar.')
      return
    }

    setIsLoadingSlots(true)
    setSelectedSlot(null)
    setSlotOptions([])
    setErrorMessage(null)
    setSlotsMessage('Carregando horários disponíveis…')

    try {
      const res = await fetch(`/api/slots?service_id=${encodeURIComponent(appointment.serviceId)}&date=${encodeURIComponent(iso)}`)
      if (!res.ok) {
        setSlotsMessage('Não foi possível carregar os horários disponíveis.')
        return
      }
      const data = (await res.json()) as SlotsResponse
      const slots = (data.slots ?? []).map((slotIso) => {
        const label = formatTime(slotIso)
        const disabled = hoursUntil(slotIso) < CANCEL_THRESHOLD_HOURS
        return { iso: slotIso, label, disabled }
      })
      setSlotOptions(slots)
      if (slots.length === 0) {
        setSlotsMessage('Sem horários para este dia.')
      } else {
        setSlotsMessage('Selecione um horário:')
      }
    } catch (error) {
      console.error('Failed to load slots', error)
      setSlotsMessage('Não foi possível carregar os horários disponíveis.')
    } finally {
      setIsLoadingSlots(false)
    }
  }

  const goToPreviousMonth = () => {
    const previous = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    if (previous < today) {
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    } else {
      setCurrentMonth(previous)
    }
  }


  const goToNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    setCurrentMonth(next)
  }

  const monthTitle = useMemo(
    () =>
      currentMonth.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
    [currentMonth],
  )

  const handleDayClick = (iso: string | null, disabled: boolean) => {
    if (!iso || disabled || iso.length !== 10) return
    setSelectedDate(iso)
    void loadSlots(iso)
  }

  const handleSlotClick = (option: SlotOption) => {
    if (option.disabled) return
    setSelectedSlot(option.iso)
  }

  const handleSubmit = async () => {
    if (!selectedSlot) return
    const token = await ensureAuth()
    if (!token) return

    setIsSaving(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ starts_at: selectedSlot }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Não foi possível salvar as alterações.' }))
        const message = typeof body.error === 'string' ? body.error : 'Não foi possível salvar as alterações.'
        setErrorMessage(message)
        return
      }

      const payload = await res.json().catch(() => ({ starts_at: selectedSlot, ends_at: null }))
      onSuccess({
        starts_at: typeof payload.starts_at === 'string' ? payload.starts_at : selectedSlot,
        ends_at: typeof payload.ends_at === 'string' ? payload.ends_at : null,
      })
    } catch (error) {
      console.error('Failed to reschedule appointment', error)
      setErrorMessage('Erro inesperado ao salvar as alterações.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.modal} aria-hidden="false">
      <div className={styles.modalBackdrop} onClick={isSaving ? undefined : onClose} />
      <div className={`${styles.modalContent} ${styles.modalEdit}`} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Alterar data e horário</h2>

        <div className={styles.calHead}>
          <button
            type="button"
            className={styles.btnNav}
            onClick={goToPreviousMonth}
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <div className={styles.calTitle}>{monthTitle}</div>
          <button
            type="button"
            className={styles.btnNav}
            onClick={goToNextMonth}
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>

        {isLoadingAvailability ? (
          <div className={styles.meta}>Carregando disponibilidade…</div>
        ) : availabilityError ? (
          <div className={styles.meta}>{availabilityError}</div>
        ) : null}

        <div className={styles.grid} aria-hidden="true">
          {calendarHeaderDays.map((label, index) => (
            <div key={`dow-${index}`} className={styles.gridDow}>
              {label}
            </div>
          ))}
        </div>

        <div className={styles.grid}>
          {calendarDays.dayEntries.map((entry) => (
            <button
              key={entry.iso}
              type="button"
              className={styles.day}
              data-state={entry.state}
              data-selected={!entry.isOutsideCurrentMonth && selectedDate === entry.iso}
              data-outside-month={entry.isOutsideCurrentMonth ? 'true' : 'false'}
              aria-disabled={entry.isDisabled}
              disabled={entry.isDisabled}
              onClick={() => handleDayClick(entry.iso, entry.isDisabled || entry.isOutsideCurrentMonth)}
            >
              {entry.day}
            </button>
          ))}
        </div>

        <div className={styles.label}>Horários disponíveis</div>
        <div className={styles.slots}>
          {isLoadingSlots ? (
            <div className={styles.meta}>{slotsMessage}</div>
          ) : slotOptions.length > 0 ? (
            slotOptions.map((option) => (
              <button
                key={option.iso}
                type="button"
                className={styles.slot}
                data-selected={selectedSlot === option.iso}
                aria-disabled={option.disabled}
                disabled={option.disabled}
                onClick={() => handleSlotClick(option)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className={styles.meta}>{slotsMessage}</div>
          )}
        </div>
        {errorMessage ? <div className={styles.modalError}>{errorMessage}</div> : null}

        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnNo}`} disabled={isSaving} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnYes}`}
            disabled={!selectedSlot || isSaving}
            onClick={handleSubmit}
          >
            {isSaving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MyAppointments() {
  const [appointments, setAppointments] = useState<NormalizedAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payingApptId, setPayingApptId] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [lastPayAttemptId, setLastPayAttemptId] = useState<string | null>(null)
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState>(null)
  const [successDialog, setSuccessDialog] = useState<SuccessDialogState>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [blockedAppointment, setBlockedAppointment] = useState<NormalizedAppointment | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<NormalizedAppointment | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<SelectedStatusCategory>(null)
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const body = document.body
    if (!body.classList.contains('procedimento-screen')) {
      body.classList.add('procedimento-screen')
    }

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2)

    const LAVA_CONFIG = {
      dark: { count: 22, radius: [90, 150] as [number, number], speed: 1.2 },
      light: { count: 18, radius: [80, 130] as [number, number], speed: 1.0 },
    }

    const steps = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.85, 0.92, 0.97]

    const buildPalette = () => {
      const style = getComputedStyle(document.documentElement)
      const dark = style.getPropertyValue('--dark').trim() || '#7aa98a'
      const light = style.getPropertyValue('--light').trim() || '#bcd6c3'
      return steps.map((step) => mixHexColors(dark, light, step))
    }

    const palette = buildPalette()

    const rand = (min: number, max: number) => min + Math.random() * (max - min)
    const pick = <T,>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)]

    const cleanups: Array<() => void> = []

    const createLayer = (canvasId: string, type: 'dark' | 'light') => {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return

      const state = {
        width: 0,
        height: 0,
        blobs: [] as Array<{
          x: number
          y: number
          r: number
          a: number
          vx: number
          vy: number
          color: string
          opacity: number
        }>,
        raf: 0,
        destroyed: false,
      }

      const resize = () => {
        const rect = canvas.getBoundingClientRect()
        state.width = Math.ceil(rect.width * devicePixelRatio)
        state.height = Math.ceil(rect.height * devicePixelRatio)
        canvas.width = state.width
        canvas.height = state.height
        canvas.style.transform = 'translateZ(0)'
      }

      const reseed = () => {
        const config = LAVA_CONFIG[type]
        const minOpacity = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lava-alpha-min')) || 0.4
        const maxOpacity = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lava-alpha-max')) || 0.85
        resize()
        state.blobs = []
        for (let index = 0; index < config.count; index += 1) {
          state.blobs.push({
            x: rand(0, state.width),
            y: rand(0, state.height),
            r: rand(config.radius[0], config.radius[1]) * devicePixelRatio,
            a: rand(0, Math.PI * 2),
            vx: rand(-1, 1) * config.speed * devicePixelRatio,
            vy: rand(-1, 1) * config.speed * devicePixelRatio,
            color: pick(palette),
            opacity: rand(minOpacity, maxOpacity),
          })
        }
      }

      const tick = () => {
        if (state.destroyed) return
        context.clearRect(0, 0, state.width, state.height)
        context.globalCompositeOperation = 'lighter'
        for (const blob of state.blobs) {
          blob.x += blob.vx
          blob.y += blob.vy
          const bounds = 200 * devicePixelRatio
          if (blob.x < -bounds || blob.x > state.width + bounds) blob.vx *= -1
          if (blob.y < -bounds || blob.y > state.height + bounds) blob.vy *= -1
          const projectedRadius = blob.r * (1 + Math.sin(blob.a + performance.now() * 0.002) * 0.05)
          context.globalAlpha = blob.opacity
          context.fillStyle = blob.color
          context.beginPath()
          context.arc(blob.x, blob.y, projectedRadius, 0, Math.PI * 2)
          context.fill()
        }
        state.raf = window.requestAnimationFrame(tick)
      }

      const resizeHandler = () => resize()
      window.addEventListener('resize', resizeHandler)
      cleanups.push(() => window.removeEventListener('resize', resizeHandler))
      cleanups.push(() => {
        state.destroyed = true
        if (state.raf) window.cancelAnimationFrame(state.raf)
      })

      reseed()
      tick()
    }

    createLayer('lavaDark', 'dark')
    createLayer('lavaLight', 'light')

    return () => {
      body.classList.remove('procedimento-screen')
      cleanups.forEach((fn) => fn())
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        const session = sessionData.session
        if (!session?.user?.id) {
          window.location.href = '/login'
          return
        }

        const { data, error: fetchError } = await supabase
          .from('appointments')
          .select(
            'id, starts_at, ends_at, status, total_cents, deposit_cents, valor_sinal, preco_total, service_id, service_type_id, services(id, name, service_type_assignments(service_types(id, name))), service_type:service_types!appointments_service_type_id_fkey(id, name)',
          )
          .eq('customer_id', session.user.id)
          .order('starts_at', { ascending: true })

        if (fetchError) throw fetchError

        const rows = data ?? []
        const ids = rows.map((row) => row.id).filter(Boolean)

        const totalsMap = new Map<string, number>()
        if (ids.length > 0) {
          const { data: totalsData, error: totalsError } = await supabase
            .from('appointment_payment_totals')
            .select('appointment_id, paid_cents')
            .in('appointment_id', ids)
            .returns<AppointmentTotalsRecord[]>()

          if (!totalsError) {
            for (const total of totalsData ?? []) {
              const amount = parseNumeric(total.paid_cents)
              if (Number.isFinite(amount)) {
                totalsMap.set(total.appointment_id, Math.max(0, amount))
              }
            }
          }
        }

        const normalized = rows.map((row) => normalizeAppointment(row, totalsMap))
        setAppointments(normalized)
        setError(null)
      } catch (err) {
        console.error('Failed to load appointments', err)
        setError('Não foi possível carregar os agendamentos. Tente novamente mais tarde.')
        setAppointments([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const ensureAuth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      window.location.href = '/login'
      return null
    }
    return data.session.access_token ?? null
  }, [])

  const filteredAppointments = useMemo(
    () =>
      selectedCategory
        ? appointments.filter((appointment) => STATUS_FILTERS[selectedCategory].includes(appointment.status))
        : [],
    [appointments, selectedCategory],
  )

  const completionSummary = useMemo(() => {
    const canceledCount = appointments.filter((appointment) => appointment.status === 'canceled').length
    const completedAppointments = appointments.filter((appointment) => appointment.status === 'completed')
    const completedCount = completedAppointments.length
    const totalCompletedValue = completedAppointments.reduce(
      (sum, appointment) => sum + appointment.totalValue,
      0,
    )

    return { canceledCount, completedCount, totalCompletedValue }
  }, [appointments])

  const hasAppointments = appointments.length > 0

  const startDepositPayment = useCallback(
    async (appointmentId: string) => {
      setPayError(null)
      setLastPayAttemptId(appointmentId)

      if (!stripePromise) {
        setPayError('Checkout indisponível. Verifique a chave pública do Stripe.')
        return
      }

      const token = await ensureAuth()
      if (!token) return

      setPayingApptId(appointmentId)

      try {
        const res = await fetch('/api/payments/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ appointment_id: appointmentId, mode: 'deposit' }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Falha na criação do pagamento' }))
          setPayError(typeof err.error === 'string' ? err.error : 'Não foi possível iniciar o checkout.')
          return
        }

        const payload = await res.json()

        if (payload.client_secret) {
          router.push(
            `/checkout?client_secret=${encodeURIComponent(payload.client_secret)}&appointment_id=${encodeURIComponent(appointmentId)}`,
          )
        } else {
          setPayError('Resposta inválida do servidor ao iniciar o checkout.')
        }
      } catch (err) {
        console.error(err)
        setPayError('Erro inesperado ao iniciar o checkout.')
      } finally {
        setPayingApptId(null)
      }
    },
    [ensureAuth, router],
  )

  const handleCancelRequest = (appointment: NormalizedAppointment) => {
    const diff = hoursUntil(appointment.startsAt)
    if (diff >= CANCEL_THRESHOLD_HOURS) {
      setCancelDialog({ variant: 'standard', appointment })
    } else {
      setCancelDialog({ variant: 'penalty', appointment })
    }
    setCancelError(null)
  }

  const handleCancelConfirm = useCallback(
    async (dialog: CancelDialogState) => {
      if (!dialog) return
      const token = await ensureAuth()
      if (!token) return

      setCancelingId(dialog.appointment.id)
      setCancelError(null)

      try {
        const res = await fetch(`/api/appointments/${dialog.appointment.id}/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Não foi possível cancelar o agendamento.' }))
          const message = typeof body.error === 'string' ? body.error : 'Não foi possível cancelar o agendamento.'
          setCancelError(message)
          return
        }

        setAppointments((prev) =>
          prev.map((item) => (item.id === dialog.appointment.id ? { ...item, status: 'canceled' } : item)),
        )
        setCancelDialog(null)
        setSuccessDialog({
          title: 'Agendamento cancelado',
          message: 'Seu agendamento foi cancelado com sucesso.',
        })
      } catch (err) {
        console.error(err)
        setCancelError('Erro inesperado ao cancelar o agendamento.')
      } finally {
        setCancelingId(null)
      }
    },
    [ensureAuth],
  )

  const handleEditRequest = (appointment: NormalizedAppointment) => {
    const diff = hoursUntil(appointment.startsAt)
    if (diff < CANCEL_THRESHOLD_HOURS) {
      setBlockedAppointment(appointment)
      return
    }
    setEditingAppointment(appointment)
  }

  const handleRescheduleSuccess = (appointmentId: string, nextStartsAt: string, nextEndsAt: string | null) => {
    setAppointments((prev) =>
      prev.map((item) =>
        item.id === appointmentId
          ? {
              ...item,
              startsAt: nextStartsAt,
              endsAt: nextEndsAt,
            }
          : item,
      ),
    )
    setEditingAppointment(null)
    setSuccessDialog({
      title: 'Agendamento atualizado',
      message: 'A nova data e horário foram salvos com sucesso.',
    })
  }

  const closeSuccessDialog = () => {
    setSuccessDialog(null)
  }

  const closeCancelDialog = () => {
    setCancelDialog(null)
    setCancelError(null)
  }

  return (
    <main className={styles.wrapper}>
      <Script id="procedimento-body-class" strategy="beforeInteractive">
        {"document.body.classList.add('procedimento-screen');"}
      </Script>
      <style id="procedimento-style" dangerouslySetInnerHTML={{ __html: PROCEDIMENTO_CSS }} />

      <div className="procedimento-root">
        <div className="texture" aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <filter id="mottle" x="-50%" y="-50%" width="200%" height="200%">
                <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="11" result="turb" />
                <feGaussianBlur stdDeviation="18" in="turb" result="blur" />
                <feBlend in="SourceGraphic" in2="blur" mode="multiply" />
              </filter>
            </defs>
            <rect x="0" y="0" width="100" height="100" fill="#e9f3ee" filter="url(#mottle)" />
          </svg>
        </div>

        <div className="lamp" aria-hidden="true">
          <canvas id="lavaDark" className="lava dark" />
          <canvas id="lavaLight" className="lava light" />
        </div>

        <div className="page">
          <section className="center">
            <div className="stack">
              <header className={styles.header}>
                <svg
                  aria-hidden="true"
                  className="diamond"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M12 3l4 4-4 4-4-4 4-4Z" />
                  <path d="M12 13l4 4-4 4-4-4 4-4Z" />
                </svg>
                <h1 className={styles.title}>Meus agendamentos</h1>
                <p className={styles.subtitle}>Veja seus horários ativos e históricos</p>
              </header>

              <div className={`glass ${styles.glass}`}>
                <div className={styles.label}>Seus horários</div>

                <div className={styles.filterGrid} role="group" aria-label="Filtro de agendamentos">
                  {statusCards.map((card) => {
                    const isActive = selectedCategory === card.key
                    return (
                      <button
                        key={card.key}
                        type="button"
                        className={styles.filterCard}
                        data-active={isActive ? 'true' : 'false'}
                        onClick={() => setSelectedCategory(card.key)}
                      >
                        <div className={styles.filterCardInner}>
                          <span className={styles.filterTitle}>{card.title}</span>
                          <span className={styles.filterDescription}>{card.description}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedCategory ? (
                <div className={`glass ${styles.glass} ${styles.resultsCard}`}>
                  {loading ? (
                    <div className={`${styles.stateCard} ${styles.stateNeutral}`}>Carregando…</div>
                  ) : error ? (
                    <div className={`${styles.stateCard} ${styles.stateError}`}>{error}</div>
                  ) : !hasAppointments ? (
                    <div className={`${styles.stateCard} ${styles.stateEmpty}`}>
                      <p>Você ainda não tem agendamentos cadastrados.</p>
                      <span className={styles.stateHint}>Agende um horário para vê-lo aqui.</span>
                    </div>
                  ) : filteredAppointments.length === 0 ? (
                    <div className={`${styles.stateCard} ${styles.stateEmpty}`}>
                      <p>{statusEmptyMessages[selectedCategory]}</p>
                      <span className={styles.stateHint}>Altere o filtro para ver outros status.</span>
                    </div>
                  ) : (
                    <>
                      {selectedCategory === 'concluidos' && filteredAppointments.length > 0 ? (
                        <div className={styles.summaryGrid}>
                          <div className={styles.summaryCard}>
                            <div className={styles.summaryLabel}>Cancelados</div>
                            <div className={styles.summaryValue}>{completionSummary.canceledCount}</div>
                          </div>
                          <div className={styles.summaryCard}>
                            <div className={styles.summaryLabel}>Finalizados</div>
                            <div className={styles.summaryValue}>{completionSummary.completedCount}</div>
                          </div>
                          <div className={styles.summaryCard}>
                            <div className={styles.summaryLabel}>Valor total finalizado</div>
                            <div className={styles.summaryValue}>{toCurrency(completionSummary.totalCompletedValue)}</div>
                          </div>
                        </div>
                      ) : null}

                      <div className={styles.cards}>
                        {filteredAppointments.map((appointment) => {
                          const statusLabel = statusLabels[appointment.status] ?? appointment.status
                          const statusClass =
                            styles[`status${appointment.status.charAt(0).toUpperCase()}${appointment.status.slice(1)}`] ||
                            styles.statusDefault
                          const depositLabel = depositStatusLabel(appointment.depositValue, appointment.paidValue)
                          const showPay = canShowPay(appointment)
                          const showCancel = canShowCancel(appointment.status)
                          const showEdit = canShowEdit(appointment)
                          const actions = [showPay, showCancel, showEdit].filter(Boolean)
                          const shouldShowPayError = payError && lastPayAttemptId === appointment.id

                          return (
                            <article key={appointment.id} className={styles.card}>
                              <div className={styles.cardHeader}>
                                <div className={styles.cardInfo}>
                                  <div className={styles.serviceType}>{appointment.serviceType}</div>
                                  {appointment.serviceTechnique ? (
                                    <div className={styles.serviceTechnique}>{appointment.serviceTechnique}</div>
                                  ) : null}
                                </div>
                                <span className={`${styles.status} ${statusClass}`}>{statusLabel}</span>
                              </div>

                              <div className={styles.cardBody}>
                                <div className={styles.detail}>
                                  <div className={styles.detailLabel}>Data</div>
                                  <div className={styles.detailValue}>{formatDate(appointment.startsAt)}</div>
                                </div>
                                <div className={styles.detail}>
                                  <div className={styles.detailLabel}>Horário</div>
                                  <div className={styles.detailValue}>{formatTime(appointment.startsAt)}</div>
                                </div>
                                <div className={styles.detail}>
                                  <div className={styles.detailLabel}>Valor</div>
                                  <div className={styles.detailValue}>{toCurrency(appointment.totalValue)}</div>
                                </div>
                                <div className={styles.detail}>
                                  <div className={styles.detailLabel}>Sinal</div>
                                  <div className={styles.detailValue}>
                                    {appointment.depositValue > 0
                                      ? `${toCurrency(appointment.depositValue)} (${depositLabel})`
                                      : 'Não necessário'}
                                  </div>
                                </div>
                              </div>

                              {actions.length > 0 && (
                                <div className={styles.cardFooter}>
                                  {showPay && (
                                    <button
                                      type="button"
                                      className={`${styles.btn} ${styles.btnPay}`}
                                      onClick={() => {
                                        void startDepositPayment(appointment.id)
                                      }}
                                      disabled={payingApptId === appointment.id}
                                    >
                                      {payingApptId === appointment.id ? 'Abrindo…' : '💳 Pagar'}
                                    </button>
                                  )}
                                  {showCancel && (
                                    <button
                                      type="button"
                                      className={`${styles.btn} ${styles.btnCancel}`}
                                      onClick={() => handleCancelRequest(appointment)}
                                      disabled={cancelingId === appointment.id}
                                    >
                                      {cancelingId === appointment.id ? 'Cancelando…' : '✖ Cancelar'}
                                    </button>
                                  )}
                                  {showEdit && (
                                    <button
                                      type="button"
                                      className={`${styles.btn} ${styles.btnEdit}`}
                                      onClick={() => handleEditRequest(appointment)}
                                    >
                                      ✎ Alterar
                                    </button>
                                  )}
                                </div>
                              )}

                              {shouldShowPayError ? <div className={styles.inlineError}>{payError}</div> : null}
                            </article>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              ) : null
            </div>
          </section>
        </div>
      </div>

      <ConfirmCancelModal
        dialog={cancelDialog}
        onClose={closeCancelDialog}
        onConfirm={handleCancelConfirm}
        isProcessing={Boolean(cancelDialog && cancelingId === cancelDialog.appointment.id)}
        errorMessage={cancelError}
      />

      <SuccessModal dialog={successDialog} onClose={closeSuccessDialog} />

      <BlockedModal appointment={blockedAppointment} onClose={() => setBlockedAppointment(null)} />

      {editingAppointment ? (
        <RescheduleModal
          appointment={editingAppointment}
          onClose={() => setEditingAppointment(null)}
          ensureAuth={ensureAuth}
          onSuccess={({ starts_at, ends_at }) =>
            handleRescheduleSuccess(editingAppointment.id, starts_at, ends_at)
          }
        />
      ) : null}
    </main>
  )
}
