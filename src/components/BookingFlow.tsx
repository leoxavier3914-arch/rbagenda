'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import styles from './BookingFlow.module.css'
import { supabase } from '@/lib/db'
import { stripePromise } from '@/lib/stripeClient'

type Service = {
  id: string
  name: string
  price_cents: number
  deposit_cents: number
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatDateLabel(value: string) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function formatSlotLabel(value: string) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function BookingFlow() {
  const [services, setServices] = useState<Service[]>([])
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [slot, setSlot] = useState('')
  const [staffId, setStaffId] = useState<string | null>(null)
  const [apptId, setApptId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    async function loadServices() {
      const { data, error } = await supabase
        .from('services')
        .select('id,name,price_cents,deposit_cents')
        .eq('active', true)
        .order('name')

      if (!isMounted) return

      if (error) {
        console.error('Erro ao carregar serviços', error)
        setServices([])
        setError('Não foi possível carregar os serviços disponíveis. Tente novamente mais tarde.')
        return
      }

      setServices(data ?? [])
    }

    loadServices()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isActive = true

    if (serviceId && date) {
      setSlots([])
      setSlot('')
      setStaffId(null)
      setError(null)
      fetch(`/api/slots?service_id=${serviceId}&date=${date}`)
        .then((r) => r.json())
        .then((d) => {
          if (!isActive) return
          setStaffId(d.staff_id ?? null)
          setSlots(d.slots || [])
        })
        .catch(() => {
          if (!isActive) return
          setStaffId(null)
          setSlots([])
          setError('Não foi possível carregar os horários para esta data. Tente novamente.')
        })
    } else {
      setSlots([])
      setSlot('')
      setStaffId(null)
    }

    return () => {
      isActive = false
    }
  }, [serviceId, date])

  async function ensureAuth() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) window.location.href = '/login'
    return data.session?.access_token
  }

  async function createAppt() {
    if (!serviceId || !date || !slot || apptId) return
    setError(null)
    const token = await ensureAuth()
    if (!token) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          service_id: serviceId,
          staff_id: staffId ?? undefined,
          starts_at: slot,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Não foi possível criar o agendamento.' }))
        setError(typeof err.error === 'string' ? err.error : 'Não foi possível criar o agendamento.')
        return
      }
      const d = await res.json()
      if (d.appointment_id) {
        setApptId(d.appointment_id)
      } else {
        setError('Resposta inválida ao criar o agendamento.')
      }
    } catch (e) {
      console.error(e)
      setError('Erro inesperado ao criar o agendamento.')
    } finally {
      setIsCreating(false)
    }
  }

  async function payDeposit() {
    setError(null)
    if (!stripePromise) {
      setError('Checkout indisponível. Verifique a chave pública do Stripe.')
      return
    }
    const token = await ensureAuth()
    if (!token || !apptId) return
    setIsPaying(true)
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ appointment_id: apptId, mode: 'deposit' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha na criação do pagamento' }))
        setError(typeof err.error === 'string' ? err.error : 'Não foi possível iniciar o checkout.')
        return
      }
      const d = await res.json()
      if (d.client_secret) {
        router.push(
          `/checkout?client_secret=${encodeURIComponent(d.client_secret)}&appointment_id=${encodeURIComponent(apptId)}`,
        )
      } else {
        setError('Resposta inválida do servidor ao iniciar o checkout.')
      }
    } catch (e) {
      console.error(e)
      setError('Erro inesperado ao iniciar o checkout.')
    } finally {
      setIsPaying(false)
    }
  }

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId) ?? null,
    [services, serviceId],
  )

  const priceValue = selectedService ? selectedService.price_cents / 100 : null
  const depositValue = selectedService ? selectedService.deposit_cents / 100 : null
  const balanceValue = priceValue != null && depositValue != null ? Math.max(priceValue - depositValue, 0) : null

  const summaryPrice = priceValue != null ? formatCurrency(priceValue) : 'R$ —'
  const summarySignal =
    depositValue != null
      ? `Sinal: ${formatCurrency(depositValue)}${balanceValue != null ? ` • Saldo no dia: ${formatCurrency(balanceValue)}` : ''}`
      : 'Sinal: —'
  const summaryDate = `Data: ${formatDateLabel(date)} • Horário: ${formatSlotLabel(slot)}`

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const slotMessage = isLocked
    ? `Horário confirmado: ${formatDateLabel(date)} às ${formatSlotLabel(slot)}`
    : !serviceId
    ? 'Selecione um serviço para liberar os horários.'
    : !date
    ? 'Escolha uma data disponível para continuar.'
    : slots.length > 0
    ? 'Selecione um horário disponível:'
    : 'Nenhum horário disponível para esta data. Escolha outra data.'

  const isLocked = Boolean(apptId)

  const summaryMetaTop = apptId
    ? `Agendamento criado • ID ${apptId}`
    : selectedService
    ? selectedService.name
    : 'Selecione as opções para continuar'

  const summaryButtonLabel = apptId
    ? isPaying
      ? 'Abrindo checkout…'
      : 'Pagar sinal'
    : isCreating
    ? 'Confirmando…'
    : 'Confirmar horário'

  const summaryButtonDisabled = apptId
    ? isPaying
    : !serviceId || !date || !slot || isCreating

  return (
    <div className={styles.wrapper}>
      {error && <div className={styles.error}>{error}</div>}

      <section className={`${styles.card} ${styles.section}`} aria-labelledby="servico-label">
        <div id="servico-label" className={styles.label}>
          Serviço
        </div>
        {services.length > 0 ? (
          <div className={styles.pills} role="radiogroup" aria-label="Serviço desejado">
            {services.map((service) => {
              const isActive = serviceId === service.id
              return (
                <button
                  key={service.id}
                  type="button"
                  role="radio"
                  className={styles.pill}
                  data-active={isActive}
                  aria-checked={isActive}
                  onClick={() => {
                    if (!isLocked) {
                      setServiceId(service.id)
                      setError(null)
                    }
                  }}
                  disabled={isLocked && !isActive}
                >
                  {service.name}
                </button>
              )
            })}
          </div>
        ) : (
          <p className={styles.emptyState}>Nenhum serviço ativo disponível no momento.</p>
        )}

        {selectedService && (
          <div className={styles.infoGrid}>
            <div className={styles.infoCol}>
              <div className={styles.optRow}>
                <div className={styles.optLeft}>
                  <div className={styles.icon} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 7h16M4 12h16M4 17h10" stroke="#1f8a70" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.optTitle}>Valor do serviço</div>
                    <div className={styles.meta}>{selectedService.name}</div>
                  </div>
                </div>
                <div className={styles.meta}>{priceValue != null ? formatCurrency(priceValue) : '—'}</div>
              </div>
            </div>
            <div className={styles.infoCol}>
              <div className={styles.optRow}>
                <div className={styles.optLeft}>
                  <div className={styles.icon} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 3v18M5 8h9.5a4.5 4.5 0 1 1 0 9H7"
                        stroke="#1f8a70"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.optTitle}>Sinal para garantir</div>
                    <div className={styles.meta}>Pague agora e confirme sua reserva</div>
                  </div>
                </div>
                <div className={styles.meta}>{depositValue != null ? formatCurrency(depositValue) : '—'}</div>
              </div>
            </div>
            {balanceValue != null && (
              <div className={styles.infoCol}>
                <div className={styles.optRow}>
                  <div className={styles.optLeft}>
                    <div className={styles.icon} aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M12 5a7 7 0 1 1-6.32 9.8L4 18l3.2-1.68A7 7 0 0 1 12 5Z"
                          stroke="#1f8a70"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className={styles.optTitle}>Saldo no dia</div>
                      <div className={styles.meta}>Pago presencialmente após o procedimento</div>
                    </div>
                  </div>
                  <div className={styles.meta}>{formatCurrency(balanceValue)}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={`${styles.card} ${styles.section}`} aria-labelledby="regras-label">
        <div id="regras-label" className={styles.label}>
          Regras rápidas
        </div>
        <ul className={styles.rulesList}>
          <li>Manutenção disponível até 21 dias e com pelo menos 40% dos fios.</li>
          <li>Reaplicação indicada quando não atende às regras de manutenção.</li>
          <li>O sinal confirma o horário escolhido. O saldo é pago no dia do procedimento.</li>
        </ul>
      </section>

      <section className={`${styles.card} ${styles.section}`} aria-labelledby="agenda-label">
        <div id="agenda-label" className={styles.label}>
          Data e horário
        </div>
        <input
          type="date"
          className={styles.dateInput}
          value={date}
          min={today}
          onChange={(event) => {
            if (!isLocked) {
              setDate(event.target.value)
              setError(null)
            }
          }}
          disabled={isLocked}
        />
        <div className={styles.slotSection}>
          <div className={styles.label}>Horários</div>
          <p className={styles.slotHint}>{slotMessage}</p>
          {slots.length > 0 && (
            <div className={styles.slots} role="radiogroup" aria-label="Horário disponível">
              {slots.map((value) => {
                const isSelected = slot === value
                const label = formatSlotLabel(value)
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    className={styles.slot}
                    data-selected={isSelected}
                    aria-checked={isSelected}
                    onClick={() => {
                      if (!isLocked) {
                        setSlot(value)
                        setError(null)
                      }
                    }}
                    disabled={isLocked && !isSelected}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {apptId && (
        <div className={styles.successCard} role="status" aria-live="polite">
          <div className={styles.successHeading}>Agendamento criado com sucesso!</div>
          <div className={styles.meta}>ID do agendamento: {apptId}</div>
          <div className={styles.successActions}>
            <Link href="/dashboard/agendamentos" className={styles.outlineButton}>
              Ver meus agendamentos
            </Link>
          </div>
        </div>
      )}

      <footer className={styles.summary}>
        <div className={styles.summaryInner}>
          <div className={styles.summaryGrow}>
            <div className={styles.summaryMeta}>{summaryMetaTop}</div>
            <div className={styles.summaryPrice}>{summaryPrice}</div>
            <div className={styles.summarySignal}>{summarySignal}</div>
            <div className={styles.summaryMeta}>{summaryDate}</div>
          </div>
          <button
            type="button"
            className={styles.summaryButton}
            onClick={apptId ? payDeposit : createAppt}
            disabled={summaryButtonDisabled}
          >
            {summaryButtonLabel}
          </button>
        </div>
      </footer>
    </div>
  )
}
