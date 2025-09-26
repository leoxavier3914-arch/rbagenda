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
      <main className="min-h-screen bg-white flex items-center justify-center">
        <span className="text-sm text-gray-500">Verificando acesso…</span>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <AuthHeader />
      <main className="mx-auto max-w-md py-8">
        <BookingFlow />
      </main>
    </div>
  )
}
