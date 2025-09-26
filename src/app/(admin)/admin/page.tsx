'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import AppHeader from '@/components/AppHeader'

type AdminProfile = {
  role?: string
}

type AdminAppointment = {
  id: string
  starts_at: string
  status: string
  profiles?: { full_name?: string }
  services?: { name?: string }
}

export default function Admin(){
  const [ok,setOk]=useState(false)
  const [appts,setAppts]=useState<AdminAppointment[]>([])

  useEffect(()=>{
    (async()=>{
      const { data: sess } = await supabase.auth.getSession();
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
      }).then(r=>r.json() as Promise<AdminProfile[]>)
      if (me[0]?.role !== 'admin') {
        window.location.href='/dashboard';
        return
      }
      setOk(true)

      const ap = await fetch('/rest/v1/appointments?select=*,profiles!appointments_customer_id_fkey(full_name),services(name)&order=starts_at.desc', {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${token}`
        }
      }).then(r=>r.json() as Promise<AdminAppointment[]>)
      setAppts(ap)
    })()
  },[])

  if (!ok) return null

  return (
    <>
      <AppHeader />
      <main className="max-w-2xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Admin — Agenda</h1>
        {appts.map(a=> (
          <div key={a.id} className="p-3 border rounded grid grid-cols-2 gap-2">
            <div><b>Cliente:</b> {a.profiles?.full_name}</div>
            <div><b>Serviço:</b> {a.services?.name}</div>
            <div><b>Início:</b> {new Date(a.starts_at).toLocaleString()}</div>
            <div><b>Status:</b> {a.status}</div>
          </div>
        ))}
      </main>
    </>
  )
}
