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

  const handleSession = useCallback(async (session: Session | null) => {
    if (!session?.user?.id) {
      setAccess('checking')
      router.replace('/login')
      return
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      const role = profile?.role === 'admin' ? 'admin' : 'client'
      if (role === 'admin') {
        setAccess('admin')
      } else {
        setAccess('checking')
        router.replace('/dashboard/novo-agendamento')
      }
    } catch {
      setAccess('checking')
      router.replace('/dashboard/novo-agendamento')
    }
  }, [router])

  useEffect(()=>{
    let ignore = false

    async function checkSession(){
      const { data } = await supabase.auth.getSession()
      if (ignore) return

      if (!data.session){
        setAccess('checking')
        router.replace('/login')
        return
      }

      handleSession(data.session)
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session)=>{
      if (ignore) return
      if (!session){
        setAccess('checking')
        router.replace('/login')
        return
      }

      handleSession(session)
    })

    checkSession()

    return ()=>{
      ignore = true
      listener.subscription.unsubscribe()
    }
  },[handleSession, router])

  if (access !== 'admin'){
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="card text-center text-sm text-[color:rgba(31,45,40,0.8)]">
          Verificando acesso…
        </div>
      </main>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <AuthHeader />
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6">
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
