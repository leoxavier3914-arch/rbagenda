'use client'

import Link from 'next/link'
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) {
        window.location.href = '/login'
        return
      }

      const ap = await fetch(
        '/rest/v1/appointments?select=*,services(name)&customer_id=eq.' + sess.session?.user.id + '&order=starts_at.asc',
        {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
            Authorization: `Bearer ${token}`
          }
        }
      ).then(r => r.json() as Promise<Appointment[]>)

      setAppointments(ap)
      setLoading(false)
    })()
  }, [])

  return (
    <main className="max-w-md mx-auto space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meus agendamentos</h1>
        <Link className="text-sm underline" href="/dashboard">
          Voltar ao perfil
        </Link>
      </div>

      {loading ? (
        <p>Carregando…</p>
      ) : appointments.length === 0 ? (
        <p>Você ainda não tem agendamentos.</p>
      ) : (
        <div className="space-y-2">
          {appointments.map(a => (
            <div key={a.id} className="rounded border p-3">
              <div>
                <b>Serviço:</b> {a.services?.name}
              </div>
              <div>
                <b>Data:</b> {new Date(a.starts_at).toLocaleString()}
              </div>
              <div>
                <b>Status:</b> {a.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
