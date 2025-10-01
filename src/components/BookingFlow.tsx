'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import { stripePromise } from '@/lib/stripeClient'

import FlowShell from './FlowShell'

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
  const [staffId,setStaffId]=useState<string|null>(null)
  const [apptId,setApptId]=useState('')
  const [error,setError]=useState<string|null>(null)
  const [slotsError,setSlotsError]=useState<string|null>(null)
  const [isCreating,setIsCreating]=useState(false)
  const [isProcessingPayment,setIsProcessingPayment]=useState(false)
  const router = useRouter()

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
        setError('Não foi possível carregar os serviços disponíveis no momento. Tente novamente mais tarde.')
        return
      }

      setError(null)
      setServices(data ?? [])
    }

    loadServices()

    return () => {
      isMounted = false
    }
  },[])

  useEffect(()=>{
    if(!serviceId || !date){
      setSlots([])
      setSlot('')
      setStaffId(null)
      setSlotsError(null)
      return
    }

    const controller = new AbortController()

    async function loadSlots(){
      setSlots([])
      setSlot('')
      setStaffId(null)
      setSlotsError(null)

      try {
        const params = new URLSearchParams({ service_id: serviceId, date })
        const res = await fetch(`/api/slots?${params.toString()}`, { signal: controller.signal })
        if (!res.ok) {
          throw new Error(`Falha ao carregar horários: ${res.status}`)
        }
        const d = await res.json().catch(() => null)
        if (controller.signal.aborted) return

        const nextStaff = typeof d?.staff_id === 'string' ? d.staff_id : null
        const slotList = Array.isArray(d?.slots)
          ? d.slots.filter((value: unknown): value is string => typeof value === 'string')
          : []

        setStaffId(nextStaff)
        setSlots(slotList)
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Erro ao carregar horários disponíveis', err)
        setStaffId(null)
        setSlots([])
        setSlotsError('Não foi possível carregar os horários disponíveis. Atualize a página ou selecione outra data.')
      }
    }

    void loadSlots()

    return () => {
      controller.abort()
    }
  },[serviceId,date])

  const ensureSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Erro ao recuperar sessão do usuário', error)
      setError('Não foi possível validar sua sessão. Faça login novamente.')
      return null
    }

    const session = data.session
    if (!session) {
      router.replace('/login')
      return null
    }

    return session
  }, [router])

  const resetAppointmentState = () => {
    setApptId('')
    setError(null)
  }

  async function createAppt(){
    if (!serviceId || !slot) return

    setError(null)
    setIsCreating(true)
    resetAppointmentState()

    try {
      const session = await ensureSession()
      if (!session) return

      const res = await fetch('/api/appointments', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${session.access_token}`
        },
        body: JSON.stringify({ service_id: serviceId, staff_id: staffId ?? undefined, starts_at: slot })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha na criação do agendamento' }))
        const message = typeof err.error === 'string' ? err.error : 'Não foi possível criar o agendamento.'
        throw new Error(message)
      }

      const d = await res.json().catch(() => null)
      const appointmentId = typeof d?.appointment_id === 'string' ? d.appointment_id : null
      if (!appointmentId) {
        throw new Error('Resposta inválida ao criar o agendamento. Tente novamente.')
      }

      setApptId(appointmentId)
    } catch (err) {
      console.error('Erro ao criar agendamento', err)
      const message = err instanceof Error ? err.message : 'Não foi possível criar o agendamento. Tente novamente.'
      setError(message)
    } finally {
      setIsCreating(false)
    }
  }

  async function payDeposit(){
    setError(null)

    if(!stripePromise){
      setError('Checkout indisponível. Verifique a chave pública do Stripe.')
      return
    }

    if(!apptId){
      setError('Crie um agendamento antes de iniciar o pagamento.')
      return
    }

    setIsProcessingPayment(true)

    try {
      const session = await ensureSession()
      if (!session) return

      const res = await fetch('/api/payments/create', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${session.access_token}`
        },
        body: JSON.stringify({ appointment_id: apptId, mode: 'deposit' })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha na criação do pagamento' }))
        setError(typeof err.error === 'string' ? err.error : 'Não foi possível iniciar o checkout.')
        return
      }
      const d = await res.json()
      if (d.client_secret) {
        router.push(`/checkout?client_secret=${encodeURIComponent(d.client_secret)}&appointment_id=${encodeURIComponent(apptId)}`)
      } else {
        setError('Resposta inválida do servidor ao iniciar o checkout.')
      }
    } catch (e) {
      console.error(e)
      setError('Erro inesperado ao iniciar o checkout.')
    } finally {
      setIsProcessingPayment(false)
    }
  }

  return (
    <FlowShell>
      <div className="card space-y-6">
        <div className="space-y-1">
          <span className="badge">Novo agendamento</span>
          <h1 className="text-2xl font-semibold text-[#1f2d28]">Agendar aplicação</h1>
          <p className="muted-text">
            Escolha o serviço, data e horário ideais para você. Você poderá garantir o horário pagando o sinal na próxima etapa.
          </p>
        </div>
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="service">
            Serviço desejado
          </label>
          <select
            id="service"
            className="input-field"
            value={serviceId}
            onChange={e=>setServiceId(e.target.value)}
          >
            <option value="">Escolha o serviço…</option>
            {services.map(s=> (
              <option key={s.id} value={s.id}>
                {s.name} — R$ {(s.price_cents/100).toFixed(2)} (sinal R$ {(s.deposit_cents/100).toFixed(2)})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="date">
            Data disponível
          </label>
          <input
            id="date"
            className="input-field"
            type="date"
            value={date}
            onChange={e=>setDate(e.target.value)}
          />
        </div>
        {slotsError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
            {slotsError}
          </div>
        ) : slots.length>0 ? (
          <div className="space-y-3">
            <span className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]">Horário</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {slots.map((s) => {
                const isSelected = slot === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      isSelected
                        ? 'border-[color:#2f6d4f] bg-[#2f6d4f] text-[#f7f2e7] shadow-[0_20px_45px_-20px_rgba(35,82,58,0.35)]'
                        : 'border-[color:rgba(230,217,195,0.6)] bg-[color:rgba(255,255,255,0.7)] text-[#1f2d28] hover:border-[#2f6d4f] hover:bg-[#f7f2e7]'
                    }`}
                  >
                    {new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          serviceId && date && (
            <div className="surface-muted text-sm text-[color:rgba(31,45,40,0.7)]">
              Nenhum horário disponível para esta data. Escolha outra data para continuar.
            </div>
          )
        )}
        {!apptId ? (
          <button
            disabled={!serviceId||!date||!slot||isCreating}
            onClick={createAppt}
            className="btn-primary w-full"
          >
            {isCreating ? 'Criando agendamento…' : 'Continuar'}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="surface-muted text-sm font-medium text-[#1f2d28]">
              Agendamento criado com sucesso!<br />
              <span className="muted-text">ID: {apptId}</span>
            </div>
            <Link
              href="/dashboard/agendamentos"
              className="btn-secondary block w-full text-center"
            >
              Ver meus agendamentos
            </Link>
            <div className="grid gap-2">
              <button
                disabled={isProcessingPayment}
                onClick={payDeposit}
                className="btn-primary"
              >
                {isProcessingPayment?'Abrindo checkout…':'Pagar sinal'}
              </button>
            </div>
          </div>
        )}
      </div>
    </FlowShell>
  )
}
