'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BookingFlow from '@/components/BookingFlow'
import { supabase } from '@/lib/db'
import AuthHeader from '@/components/AuthHeader'
import type { Session } from '@supabase/supabase-js'

export default function Home(){
  const router = useRouter()
  const [access, setAccess] = useState<'checking' | 'admin'>('checking')

  const redirectTo = useCallback((path: string) => {
    setAccess('checking')
    router.replace(path)
  }, [router])

  const resolveRole = useCallback(async (session: Session | null) => {
    if (!session?.user?.id) return null

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (error) throw error

      return data?.role === 'admin' ? 'admin' : 'client'
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário', error)
      return null
    }
  }, [])

  useEffect(()=>{
    let ignore = false

    const evaluateSession = async (session: Session | null) => {
      if (ignore) return

      if (!session) {
        redirectTo('/login')
        return
      }

      const role = await resolveRole(session)
      if (ignore) return

      if (role === 'admin') {
        setAccess('admin')
      } else {
        redirectTo('/dashboard/novo-agendamento')
      }
    }

    async function checkSession(){
      const { data, error } = await supabase.auth.getSession()
      if (ignore) return

      if (error) {
        console.error('Erro ao verificar sessão do usuário', error)
        redirectTo('/login')
        return
      }

      await evaluateSession(data.session)
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session)=>{
      void evaluateSession(session)
    })

    void checkSession()

    return ()=>{
      ignore = true
      listener?.subscription?.unsubscribe()
    }
  },[redirectTo, resolveRole])

  if (access !== 'admin'){
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-10">
        <div className="card text-center text-sm text-[color:rgba(31,45,40,0.8)]">
          Verificando acesso…
        </div>
      </main>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <AuthHeader />
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="mx-auto max-w-3xl space-y-8 text-center">
          <div className="space-y-3">
            <span className="badge mx-auto">Painel administrativo</span>
            <h1 className="text-3xl font-semibold text-[#1f2d28] sm:text-4xl">
              Gerencie sua agenda com leveza
            </h1>
            <p className="mx-auto max-w-2xl text-base text-[color:rgba(31,45,40,0.7)]">
              Visualize horários disponíveis, confirme agendamentos e ofereça uma experiência acolhedora para as suas clientes.
            </p>
          </div>
          <BookingFlow />
        </div>
      </main>
    </div>
  )
}
