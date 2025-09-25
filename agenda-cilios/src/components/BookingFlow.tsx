'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'

type Service = {
  id: string
  name: string
  price_cents: number
  deposit_cents: number
}

export default function BookingFlow(){
  const [services,setServices]=useState<Service[]>([])
  const [serviceId,setServiceId]=useState('')
  const [date,setDate]=useState('')
  const [slots,setSlots]=useState<string[]>([])
  const [slot,setSlot]=useState('')
  const [apptId,setApptId]=useState('')

  useEffect(()=>{
    fetch('/rest/v1/services?select=id,name,price_cents,deposit_cents&active=eq.true', {
      headers:{ apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string }
    }).then(r=>r.json() as Promise<Service[]>).then(setServices)
  },[])

  useEffect(()=>{
    if(serviceId && date){
      fetch(`/api/slots?service_id=${serviceId}&date=${date}`).then(r=>r.json()).then(d=>setSlots(d.slots||[]))
    } else setSlots([])
  },[serviceId,date])

  async function ensureAuth(){
    const { data } = await supabase.auth.getSession();
    if (!data.session) window.location.href='/login';
    return data.session?.access_token
  }

  async function createAppt(){
    const token = await ensureAuth();
    if(!token) return
    const res = await fetch('/api/appointments', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:`Bearer ${token}`
      },
      body: JSON.stringify({ service_id: serviceId, starts_at: slot })
    })
    const d = await res.json();
    if (d.appointment_id) setApptId(d.appointment_id)
  }

  async function pay(mode:'deposit'|'full'){
    const token = await ensureAuth();
    if(!token || !apptId) return
    const res = await fetch('/api/payments/create', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:`Bearer ${token}`
      },
      body: JSON.stringify({ appointment_id: apptId, mode })
    })
    const d = await res.json();
    if (d.checkout_url) window.location.href = d.checkout_url
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Agendar aplicação</h1>
      <select className="w-full border p-2 rounded" value={serviceId} onChange={e=>setServiceId(e.target.value)}>
        <option value="">Escolha o serviço…</option>
        {services.map(s=> <option key={s.id} value={s.id}>{s.name} — R$ {(s.price_cents/100).toFixed(2)} (sinal R$ {(s.deposit_cents/100).toFixed(2)})</option>)}
      </select>
      <input className="w-full border p-2 rounded" type="date" value={date} onChange={e=>setDate(e.target.value)} />
      {slots.length>0 && (
        <select className="w-full border p-2 rounded" value={slot} onChange={e=>setSlot(e.target.value)}>
          <option value="">Escolha o horário…</option>
          {slots.map(s=> <option key={s} value={s}>{new Date(s).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</option>)}
        </select>
      )}
      {!apptId ? (
        <button disabled={!serviceId||!slot} onClick={createAppt} className="w-full bg-black text-white py-2 rounded disabled:opacity-50">Continuar</button>
      ) : (
        <div className="space-y-2">
          <div className="p-3 border rounded">Agendamento criado! ID: {apptId}</div>
          <button onClick={()=>pay('deposit')} className="w-full bg-green-600 text-white py-2 rounded">Pagar Sinal</button>
          <button onClick={()=>pay('full')} className="w-full border py-2 rounded">Pagar Tudo</button>
        </div>
      )}
    </div>
  )
}
