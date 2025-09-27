'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/db'

type AdminAppointment = {
  id: string
  starts_at: string
  status: string
  profiles: { full_name: string | null } | null
  services: { name: string | null } | null
}

type LoadingState = 'idle' | 'loading' | 'ready'

const headerDescription =
  'Visualize todos os agendamentos confirmados ou pendentes. Utilize esta visão para acompanhar pagamentos, ajustar horários e garantir a melhor experiência.'

export default function Admin() {
  const router = useRouter()
  const [status, setStatus] = useState<LoadingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<AdminAppointment[]>([])
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const fetchAppointments = useCallback(async () => {
    try {
      setStatus('loading')
      setError(null)

      const { data: sess, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        throw new Error('Não foi possível validar sua sessão. Faça login novamente.')
      }

      const session = sess.session

      if (!session?.user?.id) {
        setStatus('idle')
        router.replace('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profileError) {
        throw new Error('Não foi possível verificar suas permissões. Tente novamente.')
      }

      if (profile?.role !== 'admin') {
        setStatus('idle')
        router.replace('/dashboard')
        return
      }

      const { data: appts, error: appointmentsError } = await supabase
        .from('appointments')
        .select(
          'id, starts_at, status, profiles:profiles!appointments_customer_id_fkey(full_name), services:services(name)'
        )
        .order('starts_at', { ascending: false })

      if (appointmentsError) {
        throw new Error('Não foi possível carregar os agendamentos. Tente novamente.')
      }

      const normalizedAppointments = (appts ?? []).map((appointment) => {
        const profile = Array.isArray(appointment.profiles)
          ? appointment.profiles[0] ?? null
          : appointment.profiles ?? null

        const service = Array.isArray(appointment.services)
          ? appointment.services[0] ?? null
          : appointment.services ?? null

        return {
          id: appointment.id,
          starts_at: appointment.starts_at,
          status: appointment.status,
          profiles: profile,
          services: service,
        }
      }) satisfies AdminAppointment[]

      setAppointments(normalizedAppointments)
      setStatus('ready')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro inesperado. Tente novamente.'
      setError(message)
      setStatus('idle')
    }
  }, [router])

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!active) return
      await fetchAppointments()
    }

    load()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return

        if (!session) {
          setAppointments([])
          setStatus('idle')
          setSigningOut(false)
          router.replace('/login')
          return
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          fetchAppointments()
        }
      }
    )

    return () => {
      active = false
      subscription?.subscription.unsubscribe()
    }
  }, [fetchAppointments, router])

  const isLoading = status !== 'ready' && !error

  const handleSignOut = useCallback(async () => {
    if (signingOut) return

    setSigningOut(true)
    setSignOutError(null)

    const { error: logoutError } = await supabase.auth.signOut()

    if (logoutError) {
      setSignOutError(
        logoutError.message || 'Não foi possível encerrar a sessão. Tente novamente.'
      )
      setSigningOut(false)
      return
    }

    router.replace('/login')
    setSigningOut(false)
  }, [router, signingOut])

  if (isLoading) {
    return (
      <main
        className="flex min-h-screen flex-1 items-center justify-center px-6 py-16"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Carregando painel administrativo…</span>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="card flex-1 space-y-3">
          <span className="badge">Administração</span>
          <h1 className="text-3xl font-semibold text-[#1f2d28]">Agenda completa</h1>
          <p className="muted-text max-w-3xl">{headerDescription}</p>
        </div>
        <div className="card flex w-full max-w-[220px] flex-col gap-3 text-sm">
          <button
            className="btn-secondary w-full"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Encerrando sessão…' : 'Sair'}
          </button>
          {signOutError && (
            <p className="text-xs text-red-600">{signOutError}</p>
          )}
        </div>
      </div>

      {error ? (
        <div className="surface-muted space-y-3 text-center text-sm text-[color:rgba(31,45,40,0.8)]">
          <p>{error}</p>
          <div className="flex justify-center">
            <button className="btn-primary" onClick={fetchAppointments}>
              Tentar novamente
            </button>
          </div>
        </div>
      ) : appointments.length === 0 ? (
        <div className="surface-muted text-center text-sm text-[color:rgba(31,45,40,0.8)]">
          Nenhum agendamento encontrado por aqui ainda.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#1f2d28]">
                  {appointment.services?.name ?? 'Serviço'}
                </h2>
                <span className="rounded-full border border-[color:rgba(47,109,79,0.2)] bg-[color:rgba(47,109,79,0.1)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#2f6d4f]">
                  {appointment.status}
                </span>
              </div>
              <div className="space-y-2 text-sm text-[#1f2d28]">
                <div>
                  <span className="font-medium text-[#1f2d28]">Cliente:</span>{' '}
                  {appointment.profiles?.full_name ?? 'Sem nome informado'}
                </div>
                <div>
                  <span className="font-medium text-[#1f2d28]">Início:</span>{' '}
                  {new Date(appointment.starts_at).toLocaleString()}
                </div>
                <div className="text-xs text-[color:rgba(31,45,40,0.6)]">ID: {appointment.id}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
