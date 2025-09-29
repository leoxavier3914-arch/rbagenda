'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inter } from 'next/font/google'

import { supabase } from '@/lib/db'
import { stripePromise } from '@/lib/stripeClient'
import styles from './appointments.module.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
})

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  reserved: 'Reservado',
  confirmed: 'Confirmado',
  canceled: 'Cancelado',
  completed: 'Finalizado',
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

type ServiceShape = { name?: string | null } | null

type AppointmentRecord = {
  id: string
  starts_at: string
  ends_at: string | null
  status: string
  total_cents: number | null
  deposit_cents: number | null
  valor_sinal: number | string | null
  preco_total: number | string | null
  services?: ServiceShape | ServiceShape[]
  service_id?: string | null
}

type AppointmentTotalsRecord = {
  appointment_id: string
  paid_cents: number | string | null
}

type NormalizedAppointment = {
  id: string
  serviceId: string | null
  startsAt: string
  endsAt: string | null
  status: string
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

const extractServiceName = (services?: ServiceShape | ServiceShape[]) => {
  if (!services) return null
  if (Array.isArray(services)) {
    const first = services[0]
    if (first && typeof first === 'object') return first.name ?? null
    return null
  }
  return services?.name ?? null
}

const splitServiceTitle = (fullName: string | null): [string, string | null] => {
  if (!fullName) return ['Serviço', null]
  const separators = [' - ', ' – ', ' — ', ': ']
  for (const sep of separators) {
    if (fullName.includes(sep)) {
      const [first, second] = fullName.split(sep)
      return [first.trim() || 'Serviço', (second ?? '').trim() || null]
    }
  }
  const trimmed = fullName.trim()
  if (!trimmed) return ['Serviço', null]
  const words = trimmed.split(/\s+/)
  if (words.length >= 4) return [words.slice(0, 2).join(' '), words.slice(2).join(' ')]
  if (words.length >= 2) return [words[0], words.slice(1).join(' ')]
  return [trimmed, null]
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

  const serviceName = extractServiceName(record.services)
  const [serviceType, serviceTechnique] = splitServiceTitle(serviceName)

  return {
    id: record.id,
    serviceId: record.service_id ?? null,
    startsAt: record.starts_at,
    endsAt: record.ends_at ?? null,
    status: record.status,
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

const canShowCancel = (status: string) => !['pending', 'canceled', 'completed'].includes(status)

const canShowPay = (appointment: NormalizedAppointment) => {
  if (appointment.depositValue <= 0) return false
  if (['canceled', 'completed'].includes(appointment.status)) return false
  return Math.round(appointment.paidValue * 100) < Math.round(appointment.depositValue * 100)
}

const canShowEdit = (appointment: NormalizedAppointment) => appointment.status === 'pending'

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

  useEffect(() => {
    const iso = appointment.startsAt.slice(0, 10)
    if (hoursUntil(appointment.startsAt) >= CANCEL_THRESHOLD_HOURS) {
      setSelectedDate(iso)
      void loadSlots(iso)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.id])

  const calendarCells = useMemo(() => {
    const cells: { key: string; iso: string | null; label: string; disabled: boolean }[] = []
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const offset = firstDay.getDay()
    for (let i = 0; i < offset; i += 1) {
      cells.push({ key: `pad-${month}-${i}`, iso: null, label: '', disabled: true })
    }
    const totalDays = new Date(year, month + 1, 0).getDate()
    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day)
      date.setHours(0, 0, 0, 0)
      const iso = toIsoDate(date)
      const disabled = date <= today
      cells.push({ key: iso, iso, label: String(day), disabled })
    }
    return cells
  }, [currentMonth, today])

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
    if (!iso || disabled) return
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
          <button type="button" className={styles.btnNav} onClick={goToPreviousMonth} aria-label="Mês anterior">
            ‹
          </button>
          <div className={styles.calTitle}>{monthTitle}</div>
          <button type="button" className={styles.btnNav} onClick={goToNextMonth} aria-label="Próximo mês">
            ›
          </button>
        </div>

        <div className={`${styles.grid} ${styles.gridDow}`} aria-hidden="true">
          <div>D</div>
          <div>S</div>
          <div>T</div>
          <div>Q</div>
          <div>Q</div>
          <div>S</div>
          <div>S</div>
        </div>

        <div className={styles.grid}>
          {calendarCells.map((cell) =>
            cell.iso ? (
              <button
                key={cell.key}
                type="button"
                className={styles.day}
                data-selected={selectedDate === cell.iso}
                aria-disabled={cell.disabled}
                disabled={cell.disabled}
                onClick={() => handleDayClick(cell.iso, cell.disabled)}
              >
                {cell.label}
              </button>
            ) : (
              <div key={cell.key} className={styles.dayPlaceholder} aria-hidden="true" />
            ),
          )}
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
  const router = useRouter()

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
            'id, starts_at, ends_at, status, total_cents, deposit_cents, valor_sinal, preco_total, services(name), service_id',
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
    <main className={`${inter.className} ${styles.page}`}>
      <div className={styles.shell}>
        <h1 className={styles.title}>Meus agendamentos</h1>
        <p className={styles.subtitle}>Veja seus horários ativos e históricos</p>

        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : error ? (
          <div className={styles.errorMessage}>{error}</div>
        ) : appointments.length === 0 ? (
          <div className={styles.empty}>Você ainda não tem agendamentos cadastrados.</div>
        ) : (
          appointments.map((appointment) => {
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
                  <div className={styles.line}>
                    <strong>Data:</strong> {formatDate(appointment.startsAt)}{' '}
                    <span className={styles.dot} aria-hidden="true">
                      •
                    </span>{' '}
                    <strong>Horário:</strong> {formatTime(appointment.startsAt)}
                  </div>
                  <div className={styles.line}>
                    <strong>Valor:</strong> {toCurrency(appointment.totalValue)}
                  </div>
                  <div className={styles.line}>
                    <strong>Sinal:</strong>{' '}
                    {appointment.depositValue > 0
                      ? `${toCurrency(appointment.depositValue)} (${depositLabel})`
                      : 'não necessário'}
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
          })
        )}
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
