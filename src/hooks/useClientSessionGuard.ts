"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/db'
import type { Session } from '@supabase/supabase-js'

export async function getSessionOrRedirect(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  const session = data.session
  if (!session) {
    window.location.href = '/login'
    return null
  }

  return session
}

export function useClientSessionGuard() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let active = true

    const resolveSession = async () => {
      try {
        const resolved = await supabase.auth.getSession()
        if (!active) return

        if (resolved.error || !resolved.data.session) {
          router.replace('/login')
          return
        }

        setSession(resolved.data.session)
      } finally {
        if (active) {
          setIsReady(true)
        }
      }
    }

    void resolveSession()

    return () => {
      active = false
    }
  }, [router])

  return { session, isReady }
}

