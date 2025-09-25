'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import AppHeader from '@/components/AppHeader'

type Profile = {
  full_name?: string
  whatsapp?: string
  email?: string
}

type Appointment = {
  id: string
  starts_at: string
  status: string
  services?: { name?: string }
}

export default function Dashboard(){
  const [profile,setProfile]=useState<Profile | null>(null)
  const [appts,setAppts]=useState<Appointment[]>([])

  useEffect(()=>{
    (async()=>{
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) {
        window.location.href='/login';
        return
      }

      const me = await fetch('/rest/v1/profiles?id=eq.'+sess.session?.user.id, {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${token}`
        }
      }).then(r=>r.json() as Promise<Profile[]>)
      setProfile(me[0] ?? null)

      const ap = await fetch('/rest/v1/appointments?select=*,services(name)&customer_id=eq.'+sess.session?.user.id+'&order=starts_at.asc', {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${token}`
        }
      }).then(r=>r.json() as Promise<Appointment[]>)
      setAppts(ap)
    })()
  },[])

  return (
    <>
      <AppHeader />
      <main className="max-w-md mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        {profile && (
          <div className="p-3 border rounded">
            <div><b>Nome:</b> {profile.full_name}</div>
            <div><b>WhatsApp:</b> {profile.whatsapp}</div>
            <div><b>E-mail:</b> {profile.email}</div>
          </div>
        )}

        <h2 className="text-xl font-semibold">Meus agendamentos</h2>
        <div className="space-y-2">
          {appts.map(a=> (
            <div key={a.id} className="p-3 border rounded">
              <div><b>Serviço:</b> {a.services?.name}</div>
              <div><b>Data:</b> {new Date(a.starts_at).toLocaleString()}</div>
              <div><b>Status:</b> {a.status}</div>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
