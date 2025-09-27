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
  pending: 'bg-[rgba(255,224,178,0.3)] text-[#a66a3a] border-[rgba(255,224,178,0.7)]',
  reserved: 'bg-[rgba(207,161,122,0.18)] text-[#82573e] border-[rgba(207,161,122,0.7)] shadow-[0_0_0_1px_rgba(207,161,122,0.25)]',
  confirmed: 'bg-[rgba(149,181,155,0.18)] text-[#2f6d4f] border-[rgba(149,181,155,0.6)]',
  canceled: 'bg-[rgba(244,143,177,0.18)] text-[#b94068] border-[rgba(244,143,177,0.5)]',
  completed: 'bg-[rgba(187,222,251,0.18)] text-[#2f517a] border-[rgba(187,222,251,0.55)]',
}

const getStatusBadgeClass = (status: string) =>
  statusBadgeClasses[status] ?? 'bg-[rgba(0,0,0,0.08)] text-[#1f2d28] border-transparent'

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
    <main className="mx-auto w-full max-w-4xl">
      <section className="card card--flush-top space-y-6">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold text-[#1f2d28]">Meus agendamentos</h1>
          <p className="muted-text mx-auto max-w-2xl text-base">
            Acompanhe seus próximos atendimentos, confirme horários e veja o status de cada reserva.
          </p>
        </div>

        {loading ? (
          <div className="surface-muted text-center text-sm text-[color:rgba(31,45,40,0.7)]">Carregando…</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : appointments.length === 0 ? (
          <div className="surface-muted text-center text-sm text-[color:rgba(31,45,40,0.8)]">
            Você ainda não tem agendamentos. Marque um horário para vê-lo aqui.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {appointments.map(a => {
              const isExpanded = expandedId === a.id

              return (
                <div
                  key={a.id}
                  className={`relative overflow-hidden rounded-3xl border border-[rgba(47,109,79,0.12)] bg-gradient-to-br from-white/95 via-white to-[#f9f2ec]/80 p-5 shadow-[0_18px_35px_-22px_rgba(35,82,58,0.45)] backdrop-blur transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_28px_55px_-20px_rgba(35,82,58,0.35)] ${
                    isExpanded ? 'ring-2 ring-[#c7a27c]/80 shadow-[0_28px_55px_-18px_rgba(199,162,124,0.45)] scale-[1.01]' : ''
                  }`}
                >
                <span
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#95b59b] via-[#2f6d4f] to-[#c7a27c] transition-opacity duration-300 ${
                    isExpanded ? 'opacity-100' : 'opacity-70'
                  }`}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => toggleCard(a.id)}
                  className="group flex w-full flex-col space-y-4 text-left pt-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-semibold text-[#1f2d28] transition-colors group-hover:text-[#2f6d4f]">
                      {a.services?.name ?? 'Serviço'}
                    </h2>
                    <span
                      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-all ${getStatusBadgeClass(
                        a.status,
                      )}`}
                    >
                      {statusLabels[a.status] ?? a.status}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-[rgba(207,161,124,0.18)] bg-white/80 px-4 py-3 text-sm text-[color:rgba(31,45,40,0.85)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                    <span className="font-medium text-[#1f2d28]">Data</span>
                    <span className="ml-1 text-[color:rgba(31,45,40,0.6)]">
                      {new Date(a.starts_at).toLocaleDateString(undefined, {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="mx-1 text-[rgba(31,45,40,0.25)]">•</span>
                    <span className="font-medium text-[#1f2d28]">Horário</span>
                    <span className="ml-1 text-[color:rgba(31,45,40,0.6)]">
                      {new Date(a.starts_at).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[color:rgba(31,45,40,0.55)]">
                    <span>ID: {a.id}</span>
                    <span className="font-medium text-[color:rgba(31,45,40,0.6)]">Toque para detalhes</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-4 border-t border-[rgba(199,162,124,0.35)] pt-4">
                    {payError && (
                      <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                        {payError}
                      </div>
                    )}
                    <div className="grid gap-3">
                      <button
                        className="btn-primary shadow-[0_14px_25px_-18px_rgba(47,109,79,0.65)]"
                        disabled={payingApptId === a.id}
                        onClick={() => startDepositPayment(a.id)}
                      >
                        {payingApptId === a.id ? 'Abrindo checkout…' : 'Pagar sinal'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
