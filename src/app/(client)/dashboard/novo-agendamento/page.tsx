'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import BookingFlow from '@/components/BookingFlow'
import { supabase } from '@/lib/db'

export default function NewAppointment() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = '/login'
      }
    })
  }, [])

  return (
    <main className="max-w-md mx-auto space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Novo agendamento</h1>
        <Link className="text-sm underline" href="/dashboard">
          Voltar ao perfil
        </Link>
      </div>
      <BookingFlow />
    </main>
  )
}
