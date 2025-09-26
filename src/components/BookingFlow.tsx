'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

type Service = {
  id: string
  name: string
  price_cents: number
  deposit_cents: number
}

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

export default function BookingFlow(){
  const [services,setServices]=useState<Service[]>([])
  const [serviceId,setServiceId]=useState('')
  const [date,setDate]=useState('')
  const [slots,setSlots]=useState<string[]>([])
  const [slot,setSlot]=useState('')
  const [staffId,setStaffId]=useState<string|null>(null)
  const [apptId,setApptId]=useState('')
  const [clientSecret,setClientSecret]=useState<string|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [isLoading,setIsLoading]=useState(false)

  useEffect(()=>{
    let isMounted = true

    async function loadServices(){
      const { data, error } = await supabase
        .from('services')
        .select('id,name,price_cents,deposit_cents')
        .eq('active', true)
        .order('name')

      if (!isMounted) return

      if (error) {
        console.error('Erro ao carregar serviços', error)
        setServices([])
        return
      }

      setServices(data ?? [])
    }

    loadServices()

    return () => {
      isMounted = false
    }
  },[])

  useEffect(()=>{
    if(serviceId && date){
      setSlots([])
      setSlot('')
      setStaffId(null)
      fetch(`/api/slots?service_id=${serviceId}&date=${date}`)
        .then(r=>r.json())
        .then(d=>{
          setStaffId(d.staff_id ?? null)
          setSlots(d.slots||[])
        })
        .catch(()=>{
          setStaffId(null)
          setSlots([])
        })
    } else {
      setSlots([])
      setSlot('')
      setStaffId(null)
    }
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
      body: JSON.stringify({ service_id: serviceId, staff_id: staffId ?? undefined, starts_at: slot })
    })
    const d = await res.json();
    if (d.appointment_id) setApptId(d.appointment_id)
  }

  async function pay(mode:'deposit'|'full'){
    setError(null)
    if(!stripePromise){
      setError('Checkout indisponível. Verifique a chave pública do Stripe.')
      return
    }
    const token = await ensureAuth();
    if(!token || !apptId) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/payments/create', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${token}`
        },
        body: JSON.stringify({ appointment_id: apptId, mode })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha na criação do pagamento' }))
        setError(typeof err.error === 'string' ? err.error : 'Não foi possível iniciar o checkout.')
        return
      }
      const d = await res.json();
      if (d.client_secret) {
        setClientSecret(d.client_secret)
      } else {
        setError('Resposta inválida do servidor ao iniciar o checkout.')
      }
    } catch (e) {
      console.error(e)
      setError('Erro inesperado ao iniciar o checkout.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      {clientSecret && stripePromise ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Finalize o pagamento</h2>
          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          <div className="border rounded overflow-hidden">
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Agendar aplicação</h1>
          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          <select className="w-full border p-2 rounded" value={serviceId} onChange={e=>setServiceId(e.target.value)}>
            <option value="">Escolha o serviço…</option>
            {services.map(s=> (
              <option key={s.id} value={s.id}>
                {s.name} — R$ {(s.price_cents/100).toFixed(2)} (sinal R$ {(s.deposit_cents/100).toFixed(2)})
              </option>
            ))}
          </select>
          <input className="w-full border p-2 rounded" type="date" value={date} onChange={e=>setDate(e.target.value)} />
          {slots.length>0 ? (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((s) => {
                const isSelected = slot === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={`p-2 border rounded text-sm transition ${
                      isSelected
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </button>
                )
              })}
            </div>
          ) : (
            serviceId && date && (
              <div className="p-3 border rounded text-sm text-gray-600">Nenhum horário disponível para esta data.</div>
            )
          )}
          {!apptId ? (
            <button
              disabled={!serviceId||!date||!slot}
              onClick={createAppt}
              className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
            >
              Continuar
            </button>
          ) : (
            <div className="space-y-2">
              <div className="p-3 border rounded">Agendamento criado! ID: {apptId}</div>
              <Link
                href="/dashboard/agendamentos"
                className="block w-full rounded border bg-white py-2 text-center text-sm font-medium hover:bg-gray-50"
              >
                Ver meus agendamentos
              </Link>
              <button
                disabled={isLoading}
                onClick={()=>pay('deposit')}
                className="w-full bg-green-600 text-white py-2 rounded disabled:opacity-50"
              >
                {isLoading?'Abrindo checkout…':'Pagar Sinal'}
              </button>
              <button
                disabled={isLoading}
                onClick={()=>pay('full')}
                className="w-full border py-2 rounded disabled:opacity-50"
              >
                {isLoading?'Abrindo checkout…':'Pagar Tudo'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
