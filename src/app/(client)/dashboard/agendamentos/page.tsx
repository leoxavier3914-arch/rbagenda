'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'

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

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8">
      <div className="card space-y-1">
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
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
