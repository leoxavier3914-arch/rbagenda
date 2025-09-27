'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inter } from 'next/font/google'

import { supabase } from '@/lib/db'
import { stripePromise } from '@/lib/stripeClient'
import styles from './appointments.module.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
})

type Appointment = {
  id: string
  starts_at: string
  status: string
  services?: { name?: string }
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  reserved: 'Reservado',
  confirmed: 'Confirmado',
  canceled: 'Cancelado',
  completed: 'Finalizado',
}

const statusBadgeClasses: Record<string, string> = {
  pending: styles.badgePending,
  reserved: styles.badgeReserved,
  confirmed: styles.badgeConfirmed,
  canceled: styles.badgeCanceled,
  completed: styles.badgeCompleted,
}

const getStatusBadgeClass = (status: string) =>
  statusBadgeClasses[status] ?? styles.badgeDefault

type AppointmentCardProps = {
  appointment: Appointment
  isExpanded: boolean
  onToggle: (appointmentId: string) => void
  onStartDepositPayment: (appointmentId: string) => Promise<void>
  payingApptId: string | null
  payError: string | null
}

function AppointmentCard({
  appointment,
  isExpanded,
  onToggle,
  onStartDepositPayment,
  payingApptId,
  payError,
}: AppointmentCardProps) {
  const startsAt = new Date(appointment.starts_at)
  const formattedDate = startsAt.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const formattedTime = startsAt.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  const statusClass = getStatusBadgeClass(appointment.status)
  const statusLabel = (statusLabels[appointment.status] ?? appointment.status).toUpperCase()

  return (
    <article className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''}`}>
      <div className={styles.cardHead}>
        <div className={styles.title}>
          {appointment.services?.name ?? 'Serviço'}
        </div>
        <span className={`${styles.badge} ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className={styles.rows}>
        <div>
          <span className={styles.label}>Data:</span> {formattedDate}
        </div>
        <div>
          <span className={styles.label}>Horário:</span> {formattedTime}
        </div>
        <div style={{ wordBreak: 'break-all' }}>
          <span className={styles.label}>ID:</span> {appointment.id}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggle(appointment.id)}
        className={styles.btn}
      >
        {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
      </button>

      {isExpanded && (
        <div className={styles.details}>
          {payError && (
            <div className={styles.error}>
              {payError}
            </div>
          )}

          <button
            className={styles.detailsBtn}
            disabled={payingApptId === appointment.id}
            onClick={() => {
              void onStartDepositPayment(appointment.id)
            }}
          >
            {payingApptId === appointment.id ? 'Abrindo checkout…' : 'Pagar sinal'}
          </button>
        </div>
      )}
    </article>
  )
}

export default function MyAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [payingApptId, setPayingApptId] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        const session = sessionData.session

        if (!session?.user?.id) {
          window.location.href = '/login'
          return
        }

        const { data, error } = await supabase
          .from('appointments')
          .select('*,services(name)')
          .eq('customer_id', session.user.id)
          .order('starts_at', { ascending: true })

        if (error) {
          throw error
        }

        setAppointments(data ?? [])
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

  async function ensureAuth() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      window.location.href = '/login'
      return null
    }

    return data.session.access_token ?? null
  }

  async function startDepositPayment(appointmentId: string) {
    setPayError(null)

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

      const d = await res.json()

      if (d.client_secret) {
        router.push(
          `/checkout?client_secret=${encodeURIComponent(d.client_secret)}&appointment_id=${encodeURIComponent(appointmentId)}`,
        )
      } else {
        setPayError('Resposta inválida do servidor ao iniciar o checkout.')
      }
    } catch (e) {
      console.error(e)
      setPayError('Erro inesperado ao iniciar o checkout.')
    } finally {
      setPayingApptId(null)
    }
  }

  const toggleCard = (appointmentId: string) => {
    setExpandedId(prev => (prev === appointmentId ? null : appointmentId))
    setPayError(null)
  }

  return (
    <main className={`${inter.className} ${styles.page}`}>
      <div className={styles.container}>
        <section className={styles.section}>
          <div className={styles.header}>
            <h1 className={styles.heading}>Meus agendamentos</h1>
            <p className={styles.subtitle}>
              Acompanhe seus próximos atendimentos, confirme horários e veja o status de cada reserva.
            </p>
          </div>

          {loading ? (
            <div className={styles.loading}>Carregando…</div>
          ) : error ? (
            <div className={styles.errorMessage}>{error}</div>
          ) : appointments.length === 0 ? (
            <div className={styles.empty}>Você ainda não tem agendamentos. Marque um horário para vê-lo aqui.</div>
          ) : (
            <div className={styles.stack}>
              {appointments.map(appointment => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  isExpanded={expandedId === appointment.id}
                  onToggle={toggleCard}
                  onStartDepositPayment={startDepositPayment}
                  payingApptId={payingApptId}
                  payError={expandedId === appointment.id ? payError : null}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
