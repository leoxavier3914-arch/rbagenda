'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ClientPageShell, ClientSection } from '@/components/client/ClientPageLayout'
import { useClientPageReady } from '@/hooks/useClientPageReady'
import { useClientSessionGuard } from '@/hooks/useClientSessionGuard'
import { supabase } from '@/lib/db'
import { stripePromise } from '@/lib/stripeClient'

import {
  AppointmentsHeader,
  AppointmentsList,
  BlockedModal,
  ConfirmCancelModal,
  RescheduleModal,
  StatusFiltersBar,
  SuccessModal,
} from './@components'
import type {
  AppointmentStatus,
  CancelDialogState,
  NormalizedAppointment,
  SelectedStatusCategory,
  StatusCategory,
  SuccessDialogState,
} from './types'

import styles from './agendamentos.module.css'

const statusLabels: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  reserved: 'Reservado',
  confirmed: 'Confirmado',
  canceled: 'Cancelado',
  completed: 'Finalizado',
} as const

const knownStatusKeys = new Set<AppointmentStatus>(Object.keys(statusLabels) as AppointmentStatus[])

const STATUS_FILTERS: Record<StatusCategory, AppointmentStatus[]> = {
  ativos: ['reserved', 'confirmed'],
  pendentes: ['pending'],
  cancelados: ['canceled'],
  concluidos: ['completed'],
}

const statusEmptyMessages: Record<StatusCategory, string> = {
  ativos: 'Você ainda não tem agendamentos ativos.',
  pendentes: 'Você ainda não tem agendamentos pendentes.',
  cancelados: 'Você ainda não tem agendamentos cancelados.',
  concluidos: 'Você ainda não tem agendamentos finalizados.',
}

const ITEMS_PER_PAGE = 5

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
  const [currentPage, setCurrentPage] = useState(1)
  const [shouldScrollToResults, setShouldScrollToResults] = useState(false)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  const heroReady = useClientPageReady()
  const { session, isReady: isSessionReady } = useClientSessionGuard()

  useEffect(() => {
    if (!isSessionReady) return
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    ;(async () => {
      try {
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
  }, [isSessionReady, session?.user?.id])

  const ensureAuth = useCallback(async () => {
    if (!session?.access_token) {
      router.replace('/login')
      return null
    }
    return session.access_token ?? null
  }, [router, session?.access_token])

  const scrollToResults = useCallback(() => {
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth'
    const target = resultsRef.current
    if (target) {
      target.scrollIntoView({ behavior, block: 'start' })
    }
  }, [])

  const handleCategorySelect = useCallback(
    (category: StatusCategory) => {
      if (selectedCategory === category) {
        scrollToResults()
        return
      }

      setSelectedCategory(category)
      setCurrentPage(1)
      setShouldScrollToResults(true)
    },
    [scrollToResults, selectedCategory],
  )

  useEffect(() => {
    if (!selectedCategory || !shouldScrollToResults) return

    const timeoutId = window.setTimeout(() => {
      scrollToResults()
      setShouldScrollToResults(false)
    }, 30)

    return () => window.clearTimeout(timeoutId)
  }, [scrollToResults, selectedCategory, shouldScrollToResults])

  const filteredAppointments = useMemo(
    () =>
      selectedCategory
        ? appointments.filter((appointment) => STATUS_FILTERS[selectedCategory].includes(appointment.status))
        : [],
    [appointments, selectedCategory],
  )

  const totalPages = useMemo(
    () => (filteredAppointments.length > 0 ? Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE) : 0),
    [filteredAppointments],
  )

  useEffect(() => {
    if (filteredAppointments.length === 0) {
      setCurrentPage(1)
      return
    }

    setCurrentPage((prev) => Math.min(prev, totalPages || 1))
  }, [filteredAppointments, totalPages])

  const paginatedAppointments = useMemo(
    () =>
      filteredAppointments.slice(
        (Math.max(currentPage, 1) - 1) * ITEMS_PER_PAGE,
        Math.max(currentPage, 1) * ITEMS_PER_PAGE,
      ),
    [filteredAppointments, currentPage],
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
    <ClientPageShell heroReady={heroReady} className={styles.wrapper}>
      <ClientSection>
        <AppointmentsHeader />

        <StatusFiltersBar selectedCategory={selectedCategory} onSelect={handleCategorySelect} />

        <footer className={styles.footerMark}>ROMEIKE BEAUTY</footer>

        {selectedCategory ? (
          <AppointmentsList
            ref={resultsRef}
            selectedCategory={selectedCategory}
            loading={loading}
            error={error}
            hasAppointments={hasAppointments}
            filteredAppointments={filteredAppointments}
            statusEmptyMessages={statusEmptyMessages}
            completionSummary={completionSummary}
            toCurrency={toCurrency}
            paginatedAppointments={paginatedAppointments}
            statusLabels={statusLabels}
            formatDate={formatDate}
            formatTime={formatTime}
            depositStatusLabel={depositStatusLabel}
            canShowPay={canShowPay}
            canShowCancel={canShowCancel}
            canShowEdit={canShowEdit}
            payError={payError}
            lastPayAttemptId={lastPayAttemptId}
            payingApptId={payingApptId}
            onStartDepositPayment={(appointmentId) => {
              void startDepositPayment(appointmentId)
            }}
            onEdit={handleEditRequest}
            onCancel={handleCancelRequest}
            cancelingId={cancelingId}
            totalPages={totalPages}
            currentPage={currentPage}
            onChangePage={(page) => setCurrentPage(page)}
          />
        ) : null}
      </ClientSection>

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
          formatTime={formatTime}
          hoursUntil={hoursUntil}
          toIsoDate={toIsoDate}
          cancelThresholdHours={CANCEL_THRESHOLD_HOURS}
        />
      ) : null}
    </ClientPageShell>
  )
}
