'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'

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

  if (!ok) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="card text-center text-sm text-[color:rgba(31,45,40,0.8)]">
          Verificando permissões…
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <div className="card space-y-3">
        <span className="badge">Administração</span>
        <h1 className="text-3xl font-semibold text-[#1f2d28]">Agenda completa</h1>
        <p className="muted-text max-w-3xl">
          Visualize todos os agendamentos confirmados ou pendentes. Utilize esta visão para acompanhar pagamentos, ajustar horários e garantir a melhor experiência.
        </p>
      </div>
      {appts.length === 0 ? (
        <div className="surface-muted text-center text-sm text-[color:rgba(31,45,40,0.8)]">
          Nenhum agendamento encontrado por aqui ainda.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {appts.map(a=> (
            <div key={a.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#1f2d28]">
                  {a.services?.name ?? 'Serviço'}
                </h2>
                <span className="rounded-full border border-[color:rgba(47,109,79,0.2)] bg-[color:rgba(47,109,79,0.1)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#2f6d4f]">
                  {a.status}
                </span>
              </div>
              <div className="space-y-2 text-sm text-[#1f2d28]">
                <div>
                  <span className="font-medium text-[#1f2d28]">Cliente:</span> {a.profiles?.full_name ?? 'Sem nome informado'}
                </div>
                <div>
                  <span className="font-medium text-[#1f2d28]">Início:</span> {new Date(a.starts_at).toLocaleString()}
                </div>
                <div className="break-words text-xs text-[color:rgba(31,45,40,0.6)]">ID: {a.id}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
