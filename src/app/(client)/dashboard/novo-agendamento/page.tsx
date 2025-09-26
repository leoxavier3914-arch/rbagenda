'use client'
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
    <main className="mx-auto w-full max-w-4xl space-y-8">
      <div className="card space-y-1">
        <span className="badge">Reserva</span>
        <h1 className="text-3xl font-semibold text-[#1f2d28]">Novo agendamento</h1>
        <p className="muted-text max-w-xl">
          Escolha o melhor horário para você e confirme o sinal online em poucos minutos.
        </p>
      </div>
      <BookingFlow />
    </main>
  )
}
