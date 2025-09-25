'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BookingFlow from '@/components/BookingFlow'
import { supabase } from '@/lib/db'

export default function Home(){
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(()=>{
    let ignore = false

    async function checkSession(){
      const { data } = await supabase.auth.getSession()
      if (ignore) return

      if (!data.session){
        setIsAuthenticated(false)
        setChecked(true)
        router.replace('/login')
        return
      }

      setIsAuthenticated(true)
      setChecked(true)
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session)=>{
      if (ignore) return
      if (!session){
        setIsAuthenticated(false)
        setChecked(true)
        router.replace('/login')
        return
      }

      setIsAuthenticated(true)
      setChecked(true)
    })

    checkSession()

    return ()=>{
      ignore = true
      listener.subscription.unsubscribe()
    }
  },[router])

  if (!checked || !isAuthenticated){
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <span className="text-sm text-gray-500">Verificando acesso…</span>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-md py-8">
        <BookingFlow />
      </div>
    </main>
  )
}
