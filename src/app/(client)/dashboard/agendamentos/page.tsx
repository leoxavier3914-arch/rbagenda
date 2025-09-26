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

  async function startPayment(appointmentId: string, mode: 'deposit' | 'full') {
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
        body: JSON.stringify({ appointment_id: appointmentId, mode }),
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
    <main className="mx-auto w-full max-w-4xl space-y-8">
      <div className="card card--flush-top space-y-1">
        <span className="badge">Agenda</span>
        <h1 className="text-3xl font-semibold text-[#1f2d28]">Meus agendamentos</h1>
        <p className="muted-text max-w-xl">
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
        <div className="grid gap-4 sm:grid-cols-2">
          {appointments.map(a => (
            <div key={a.id} className="card space-y-2">
              <button
                type="button"
                onClick={() => toggleCard(a.id)}
                className="flex w-full flex-col space-y-2 text-left"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[#1f2d28]">
                    {a.services?.name ?? 'Serviço'}
                  </h2>
                  <span className="rounded-full border border-[color:rgba(47,109,79,0.2)] bg-[color:rgba(47,109,79,0.1)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#2f6d4f]">
                    {a.status}
                  </span>
                </div>
                <div className="muted-text">
                  <span className="font-medium text-[#1f2d28]">Data:</span>{' '}
                  {new Date(a.starts_at).toLocaleString()}
                </div>
                <p className="text-xs text-[color:rgba(31,45,40,0.6)]">ID: {a.id}</p>
              </button>

              {expandedId === a.id && (
                <div className="space-y-3 border-t border-[color:rgba(230,217,195,0.6)] pt-3">
                  {payError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                      {payError}
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="btn-primary"
                      disabled={payingApptId === a.id}
                      onClick={() => startPayment(a.id, 'deposit')}
                    >
                      {payingApptId === a.id ? 'Abrindo checkout…' : 'Pagar sinal'}
                    </button>
                    <button
                      className="btn-secondary"
                      disabled={payingApptId === a.id}
                      onClick={() => startPayment(a.id, 'full')}
                    >
                      {payingApptId === a.id ? 'Abrindo checkout…' : 'Pagar total'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
