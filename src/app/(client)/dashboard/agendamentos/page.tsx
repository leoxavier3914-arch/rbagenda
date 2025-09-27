'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/db'
import { stripePromise } from '@/lib/stripeClient'

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
  pending: 'bg-[#fde6bf] text-[#92400e]',
  reserved: 'bg-[#cdeedc] text-[#065f46]',
  confirmed: 'bg-[#e0f2e9] text-[#0b3b2f]',
  canceled: 'bg-[#fde2e7] text-[#9b2145]',
  completed: 'bg-[#dbeafe] text-[#1e3a8a]',
}

const getStatusBadgeClass = (status: string) =>
  statusBadgeClasses[status] ?? 'bg-[#e5ece8] text-[#1f2d28]'

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
    <article
      className={`rounded-[22px] border border-[#e6ece9] bg-white p-5 shadow-[0_6px_20px_rgba(10,44,32,0.06)] transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(10,44,32,0.10)] ${
        isExpanded ? 'shadow-[0_12px_32px_rgba(10,44,32,0.12)]' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-lg font-semibold text-[#0b3b2f]">
          {appointment.services?.name ?? 'Serviço'}
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.08em] ${statusClass}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="space-y-1 text-sm leading-relaxed text-[#37423f]">
        <div>
          <span className="font-semibold text-[#22312c]">Data:</span> {formattedDate}
        </div>
        <div>
          <span className="font-semibold text-[#22312c]">Horário:</span> {formattedTime}
        </div>
        <div className="break-all">
          <span className="font-semibold text-[#22312c]">ID:</span> {appointment.id}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggle(appointment.id)}
        className="mt-4 w-full rounded-[14px] bg-[#065f46] px-4 py-3 text-sm font-semibold tracking-wide text-white shadow-[0_6px_16px_rgba(6,95,70,0.18)] transition duration-150 ease-in-out hover:brightness-105 active:translate-y-[1px]"
      >
        {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
      </button>

      {isExpanded && (
        <div className="mt-4 rounded-[18px] border border-[#d7e4df] bg-[#f6fbf8] p-4 shadow-inner">
          {payError && (
            <div className="mb-3 rounded-[18px] border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
              {payError}
            </div>
          )}

          <button
            className="w-full rounded-[14px] bg-[#047857] px-4 py-3 text-sm font-semibold tracking-wide text-white shadow-[0_10px_18px_rgba(4,120,87,0.25)] transition duration-150 ease-in-out hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
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
    <main className="relative -mx-6 flex justify-center bg-gradient-to-b from-white via-[#f3faf6] to-[#f0f7f3] px-6 py-10 sm:-mx-8 lg:-mx-10">
      <div className="w-full max-w-[680px]">
        <section className="space-y-6">
          <div className="text-center">
            <h1 className="text-[32px] font-extrabold leading-tight text-[#0b3b2f]">Meus agendamentos</h1>
            <p className="mt-2 text-base leading-relaxed text-[#5b6b67]">
              Acompanhe seus próximos atendimentos, confirme horários e veja o status de cada reserva.
            </p>
          </div>

          {loading ? (
            <div className="text-center text-sm text-[rgba(31,45,40,0.7)]">Carregando…</div>
          ) : error ? (
            <div className="rounded-[22px] border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : appointments.length === 0 ? (
            <div className="text-center text-sm text-[rgba(31,45,40,0.8)]">
              Você ainda não tem agendamentos. Marque um horário para vê-lo aqui.
            </div>
          ) : (
            <div className="grid gap-4">
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
