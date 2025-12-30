'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/db'
import { stripePromise } from '@/lib/stripeClient'
import { resolveFinalServiceValues } from '@/lib/servicePricing'

import FlowShell from './FlowShell'

type Service = {
  id: string
  name: string
  price_cents: number
  deposit_cents: number
  duration_min: number
}

type AssignmentRow = {
  use_service_defaults?: boolean | null
  override_duration_min?: number | null
  override_price_cents?: number | null
  override_deposit_cents?: number | null
  override_buffer_min?: number | null
  service_type?:
    | {
        id?: string | null
        active?: boolean | null
        base_duration_min?: number | null
        base_price_cents?: number | null
        base_deposit_cents?: number | null
        base_buffer_min?: number | null
      }
    | null
}

type SlotCacheEntry = {
  slots: string[]
  staffId: string | null
  fetchedAt: number
}

const SLOT_CACHE_TTL = 2 * 60 * 1000 // 2 minutos
const PREFETCH_SERVICE_LIMIT = 2
const PREFETCH_DAY_COUNT = 3

const formatISODate = (date: Date) => date.toISOString().slice(0, 10)

const buildUpcomingDates = (count: number) => {
  const today = new Date()
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(today)
    next.setDate(today.getDate() + index)
    return formatISODate(next)
  })
}

export default function BookingFlow(){
  const [services,setServices]=useState<Service[]>([])
  const [serviceId,setServiceId]=useState('')
  const [date,setDate]=useState('')
  const [slots,setSlots]=useState<string[]>([])
  const [isLoadingSlots,setIsLoadingSlots]=useState(false)
  const [slot,setSlot]=useState('')
  const [staffId,setStaffId]=useState<string|null>(null)
  const [apptId,setApptId]=useState('')
  const [error,setError]=useState<string|null>(null)
  const [slotsError,setSlotsError]=useState<string|null>(null)
  const [isCreating,setIsCreating]=useState(false)
  const [isProcessingPayment,setIsProcessingPayment]=useState(false)
  const scheduleSectionRef = useRef<HTMLDivElement | null>(null)
  const slotCacheRef = useRef<Map<string, SlotCacheEntry>>(new Map())

  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    []
  )

  const formattedSlots = useMemo(
    () =>
      slots.map((value) => {
        const parsed = new Date(value)
        const label = Number.isNaN(parsed.getTime())
          ? value
          : timeFormatter.format(parsed)

        return { value, label }
      }),
    [slots, timeFormatter]
  )
  const router = useRouter()

  useEffect(()=>{
    let isMounted = true

    async function loadServices(){
      const { data, error } = await supabase
        .from('services')
        .select(
          'id, name, active, assignments:service_type_assignments(use_service_defaults, override_duration_min, override_price_cents, override_deposit_cents, override_buffer_min, service_type:service_types(id, active, base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min))',
        )
        .eq('active', true)
        .order('name')

      if (!isMounted) return

      if (error) {
        console.error('Erro ao carregar serviços', error)
        setServices([])
        setError('Não foi possível carregar os serviços disponíveis no momento. Tente novamente mais tarde.')
        return
      }

      const normalized =
        (data ?? [])
          .map((entry) => {
            const assignments = Array.isArray(entry.assignments)
              ? (entry.assignments as AssignmentRow[])
              : entry.assignments
              ? [entry.assignments as AssignmentRow]
              : []

            const firstActive = assignments.find((assignment) => {
              const serviceType = assignment?.service_type
              return serviceType && typeof serviceType === 'object' && serviceType.active !== false
            })

            const serviceType = firstActive?.service_type
            if (!serviceType || typeof serviceType !== 'object' || !serviceType.id) {
              return null
            }

            const finalValues = resolveFinalServiceValues(
              {
                base_duration_min: serviceType.base_duration_min ?? 0,
                base_price_cents: serviceType.base_price_cents ?? 0,
                base_deposit_cents: serviceType.base_deposit_cents ?? 0,
                base_buffer_min: serviceType.base_buffer_min ?? 0,
              },
              {
                use_service_defaults: firstActive.use_service_defaults ?? true,
                override_duration_min: firstActive.override_duration_min ?? null,
                override_price_cents: firstActive.override_price_cents ?? null,
                override_deposit_cents: firstActive.override_deposit_cents ?? null,
                override_buffer_min: firstActive.override_buffer_min ?? null,
              },
            )

            if (!Number.isFinite(finalValues.duration_min) || finalValues.duration_min <= 0) return null

            return {
              id: entry.id,
              name: entry.name ?? 'Serviço',
              price_cents: Math.max(0, finalValues.price_cents),
              deposit_cents: Math.max(0, finalValues.deposit_cents),
              duration_min: Math.max(0, finalValues.duration_min),
            } as Service
          })
          .filter(Boolean) as Service[]

      setError(null)
      setServices(normalized)
    }

    loadServices()

    return () => {
      isMounted = false
    }
  },[])

  const deferredServiceId = useDeferredValue(serviceId)
  const deferredDate = useDeferredValue(date)

  useEffect(() => {
    if (!date) return

    const targetSection = scheduleSectionRef.current
    if (!targetSection) return

    targetSection?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
  }, [date])

  const makeCacheKey = useCallback((service: string, selectedDate: string) => `${service}::${selectedDate}`, [])

  const getCachedSlots = useCallback(
    (service: string, selectedDate: string) => {
      const key = makeCacheKey(service, selectedDate)
      const cached = slotCacheRef.current.get(key)
      if (!cached) return null

      if (Date.now() - cached.fetchedAt > SLOT_CACHE_TTL) {
        slotCacheRef.current.delete(key)
        return null
      }

      return cached
    },
    [makeCacheKey]
  )

  const storeSlotsInCache = useCallback(
    (service: string, selectedDate: string, payload: { slots: string[]; staffId: string | null }) => {
      const key = makeCacheKey(service, selectedDate)
      slotCacheRef.current.set(key, { ...payload, fetchedAt: Date.now() })
    },
    [makeCacheKey]
  )

  const fetchSlotsFor = useCallback(
    async (service: string, selectedDate: string, signal: AbortSignal) => {
      const params = new URLSearchParams({ service_id: service, date: selectedDate })
      const res = await fetch(`/api/slots?${params.toString()}`, { signal })
      if (!res.ok) {
        throw new Error(`Falha ao carregar horários: ${res.status}`)
      }

      const d = await res.json().catch(() => null)
      if (signal.aborted) {
        return { slots: [], staffId: null }
      }

      const nextStaff = typeof d?.staff_id === 'string' ? d.staff_id : null
      const slotList = Array.isArray(d?.slots)
        ? d.slots.filter((value: unknown): value is string => typeof value === 'string')
        : []

      storeSlotsInCache(service, selectedDate, { slots: slotList, staffId: nextStaff })

      return { slots: slotList, staffId: nextStaff }
    },
    [storeSlotsInCache]
  )

  useEffect(() => {
    if (!serviceId || !date) {
      setSlots([])
      setSlot('')
      setStaffId(null)
      setSlotsError(null)
      setIsLoadingSlots(false)
      return
    }

    setSlot('')
    setSlotsError(null)

    const cached = getCachedSlots(serviceId, date)
    if (cached) {
      setSlots(cached.slots)
      setStaffId(cached.staffId)
      setIsLoadingSlots(false)
    } else {
      setSlots([])
      setStaffId(null)
      setIsLoadingSlots(true)
    }
  }, [serviceId, date, getCachedSlots])

  useEffect(()=>{
    if(!deferredServiceId || !deferredDate){
      return
    }

    const cached = getCachedSlots(deferredServiceId, deferredDate)
    if (cached) {
      // Já temos os dados atualizados em cache; não precisamos buscar novamente.
      return
    }

    const controller = new AbortController()
    let isActive = true

    if (serviceId === deferredServiceId && date === deferredDate) {
      setIsLoadingSlots(true)
    }

    async function loadSlots(){
      try {
        const { slots: slotList, staffId: nextStaff } = await fetchSlotsFor(
          deferredServiceId,
          deferredDate,
          controller.signal
        )

        if (!isActive || controller.signal.aborted) {
          return
        }

        if (serviceId === deferredServiceId && date === deferredDate) {
          setStaffId(nextStaff)
          setSlots(slotList)
          setSlotsError(null)
        }
      } catch (err) {
        if (controller.signal.aborted || !isActive) return
        console.error('Erro ao carregar horários disponíveis', err)
        if (serviceId === deferredServiceId && date === deferredDate) {
          setStaffId(null)
          setSlots([])
          setSlotsError('Não foi possível carregar os horários disponíveis. Atualize a página ou selecione outra data.')
        }
      } finally {
        if (!isActive || controller.signal.aborted) return
        if (serviceId === deferredServiceId && date === deferredDate) {
          setIsLoadingSlots(false)
        }
      }
    }

    void loadSlots()

    return () => {
      isActive = false
      controller.abort()
    }
  },[deferredServiceId,deferredDate,serviceId,date,fetchSlotsFor,getCachedSlots])

  useEffect(() => {
    if (services.length === 0) return

    const servicePool = services.slice(0, PREFETCH_SERVICE_LIMIT)
    const datesToPrefetch = buildUpcomingDates(PREFETCH_DAY_COUNT)
    const controllers: AbortController[] = []

    for (const service of servicePool) {
      for (const upcomingDate of datesToPrefetch) {
        if (getCachedSlots(service.id, upcomingDate)) {
          continue
        }

        const controller = new AbortController()
        controllers.push(controller)

        void fetchSlotsFor(service.id, upcomingDate, controller.signal).catch((err) => {
          if (controller.signal.aborted) return
          console.error('Erro ao pré-carregar horários disponíveis', err)
        })
      }
    }

    return () => {
      controllers.forEach((controller) => controller.abort())
    }
  }, [services, fetchSlotsFor, getCachedSlots])

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
        ) : (
          <div ref={scheduleSectionRef} className="space-y-3">
            <span className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]">Horário</span>
            {isLoadingSlots ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-11 animate-pulse rounded-2xl border border-[color:rgba(230,217,195,0.45)] bg-[color:rgba(255,255,255,0.6)]"
                  />
                ))}
              </div>
            ) : slots.length>0 ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {formattedSlots.map(({ value, label }) => {
                  const isSelected = slot === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSlot(value)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                        isSelected
                          ? 'border-[color:#2f6d4f] bg-[#2f6d4f] text-[#f7f2e7] shadow-[0_20px_45px_-20px_rgba(35,82,58,0.35)]'
                          : 'border-[color:rgba(230,217,195,0.6)] bg-[color:rgba(255,255,255,0.7)] text-[#1f2d28] hover:border-[#2f6d4f] hover:bg-[#f7f2e7]'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            ) : (
              serviceId && date && (
                <div className="surface-muted text-sm text-[color:rgba(31,45,40,0.7)]">
                  Nenhum horário disponível para esta data. Escolha outra data para continuar.
                </div>
              )
            )}
          </div>
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
              href="/agendamentos"
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
