'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Elements,
  LinkAuthenticationElement,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import type {
  Appearance,
  PaymentIntent,
  StripeElementsOptions,
  StripeLinkAuthenticationElementChangeEvent,
  StripeLinkAuthenticationElementOptions,
  StripePaymentElementOptions,
} from '@stripe/stripe-js'
import { useEffect, useMemo, useState } from 'react'

import { stripePromise } from '@/lib/stripeClient'

type CheckoutPageProps = {
  clientSecret: string
  appointmentId?: string
}

export default function CheckoutPage({ clientSecret, appointmentId }: CheckoutPageProps){
  const router = useRouter()

  const hasCheckout = Boolean(clientSecret) && Boolean(stripePromise)
  const errorMessage = !stripePromise
    ? 'Checkout indisponível. Verifique a configuração da chave pública do Stripe.'
    : !clientSecret
      ? 'Não encontramos uma sessão de pagamento ativa. Volte e tente gerar o checkout novamente.'
      : null

  const appearance: Appearance = useMemo(
    () => ({
      theme: 'stripe',
      variables: {
        colorPrimary: '#2f6d4f',
        colorBackground: '#ffffff',
        colorText: '#1f2d28',
        colorDanger: '#dc2626',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '16px',
      },
      rules: {
        '.Input': {
          borderRadius: '14px',
          border: '1px solid rgba(47,109,79,0.18)',
          padding: '14px 16px',
        },
        '.Input--invalid': {
          borderColor: '#dc2626',
        },
        '.Tab': {
          borderRadius: '12px',
          border: '1px solid rgba(47,109,79,0.18)',
        },
      },
    }),
    []
  )

  const elementsOptions: StripeElementsOptions | undefined = useMemo(() => {
    if (!clientSecret) return undefined
    return {
      clientSecret,
      appearance,
    }
  }, [appearance, clientSecret])

  return (
    <div className="relative min-h-screen w-full bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#faf9f6_52%,_#f5f0e6_100%)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-white/90 via-white/40 to-transparent" aria-hidden="true" />
      <div className="mx-auto w-full max-w-[1050px] space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(27,94,74,0.24)] bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#1b5e4a]">
              Pagamento seguro
            </span>
            <h1 className="text-3xl font-semibold text-[#1b1b1b] sm:text-[34px]">Finalize seu checkout</h1>
            <p className="max-w-xl text-sm leading-relaxed text-[rgba(106,90,70,0.85)]">
              Revise os dados, escolha a forma de pagamento e conclua o pedido com tranquilidade.
            </p>
            {appointmentId && (
              <p className="text-xs font-medium uppercase tracking-wide text-[rgba(27,94,74,0.75)]">
                Agendamento <span className="font-semibold text-[#1b5e4a]">#{appointmentId}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={()=>router.back()}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(27,94,74,0.25)] bg-white/90 px-5 py-2 font-medium text-[#1b5e4a] transition hover:border-[#1b5e4a] hover:bg-[#f7f3ed]"
            >
              ← Voltar
            </button>
            <Link
              href="/dashboard/agendamentos"
              className="font-medium text-[rgba(106,90,70,0.85)] underline-offset-4 hover:text-[#1b5e4a] hover:underline"
            >
              Ver agendamentos
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-[22px] border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-[0_12px_24px_rgba(220,38,38,0.12)] sm:px-6">
            {errorMessage}
          </div>
        )}

        {hasCheckout && elementsOptions && stripePromise && (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <ManualCheckoutForm appointmentId={appointmentId} clientSecret={clientSecret} />
          </Elements>
        )}
      </div>
    </div>
  )
}

type ManualCheckoutFormProps = {
  appointmentId?: string
  clientSecret: string
}

type ClientPaymentIntent = PaymentIntent & {
  metadata?: Record<string, string | undefined>
}

function ManualCheckoutForm({ appointmentId, clientSecret }: ManualCheckoutFormProps){
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<PaymentIntent['status'] | 'idle' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [intent, setIntent] = useState<ClientPaymentIntent | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
  const [coupon, setCoupon] = useState('')
  const [couponApplied, setCouponApplied] = useState(false)

  const linkOptions = useMemo<StripeLinkAuthenticationElementOptions>(
    () => ({
      defaultValues: email ? { email } : undefined,
    }),
    [email]
  )

  const paymentElementOptions: StripePaymentElementOptions = useMemo(
    () => ({
      layout: 'tabs',
    }),
    []
  )

  const handleLinkChange = (event: StripeLinkAuthenticationElementChangeEvent) => {
    setEmail(event.value.email ?? '')
  }

  useEffect(() => {
    if (!stripe || !clientSecret) return
    let isMounted = true
    stripe.retrievePaymentIntent(clientSecret).then((result) => {
      if (!isMounted) return
      const paymentIntent = (result.paymentIntent as ClientPaymentIntent | null) ?? null
      setIntent(paymentIntent)
      if (paymentIntent) {
        if (paymentIntent.receipt_email) {
          setEmail((prev) => prev || paymentIntent.receipt_email || '')
        }
        setStatus(paymentIntent.status)
        if (paymentIntent.status === 'succeeded') {
          setMessage('Pagamento confirmado com sucesso!')
        } else if (paymentIntent.status === 'requires_payment_method') {
          setMessage('Informe um método de pagamento para continuar.')
        } else if (paymentIntent.status === 'processing') {
          setMessage('Estamos processando o seu pagamento. Aguarde alguns instantes.')
        } else if (paymentIntent.status === 'requires_action') {
          setMessage('Conclua a autenticação adicional para finalizar o pagamento.')
        } else {
          setMessage(null)
        }
      }
    })
    return () => {
      isMounted = false
    }
  }, [clientSecret, stripe])

  const formattedAmount = useMemo(() => {
    if (!intent?.amount || !intent.currency) return null
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: intent.currency.toUpperCase(),
    })
    return formatter.format(intent.amount / 100)
  }, [intent])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stripe || !elements) return

    setIsSubmitting(true)
    setStatus('processing')
    setMessage(null)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success?ref=${encodeURIComponent(appointmentId ?? '')}&session_id=${encodeURIComponent(
          intent?.id ?? ''
        )}`,
      },
      redirect: 'if_required',
    })

    if (error) {
      setStatus('error')
      setMessage(error.message ?? 'Não foi possível concluir o pagamento. Verifique os dados e tente novamente.')
      setIsSubmitting(false)
      return
    }

    if (paymentIntent) {
      setIntent(paymentIntent as ClientPaymentIntent)
      setStatus(paymentIntent.status)
      if (paymentIntent.status === 'succeeded') {
        setMessage('Pagamento confirmado com sucesso! Você será redirecionado em instantes.')
        setTimeout(() => {
          router.push('/dashboard/agendamentos')
        }, 2000)
      } else if (paymentIntent.status === 'processing') {
        setMessage('Estamos processando o seu pagamento. Assim que finalizar você receberá um e-mail.')
      } else if (paymentIntent.status === 'requires_action') {
        setMessage('Conclua a autenticação adicional do seu banco para finalizar o pagamento.')
      } else {
        setMessage('Pagamento em análise. Você receberá uma confirmação por e-mail em breve.')
      }
    }

    setIsSubmitting(false)
  }

  const isSuccess = status === 'succeeded'
  const isProcessing = status === 'processing' || isSubmitting

  const handleCouponApply = () => {
    if (!coupon) return
    setCouponApplied(true)
    setTimeout(() => {
      setCoupon('')
    }, 600)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6 rounded-[22px] border border-[rgba(44,138,110,0.18)] bg-white p-6 shadow-[0_30px_60px_rgba(16,32,24,0.12)] sm:p-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#1b5e4a]">Seus dados</h2>
            <p className="text-sm leading-relaxed text-[rgba(106,90,70,0.85)]">
              Preencha com atenção para receber a confirmação do pagamento e atualizações do seu agendamento.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-semibold text-[rgba(106,90,70,0.9)]">
              Nome completo
              <input
                value={fullName}
                onChange={(event)=>setFullName(event.target.value)}
                type="text"
                placeholder="Ex.: Agnes Romeike"
                className="w-full rounded-[12px] border border-[rgba(27,94,74,0.18)] bg-white/90 px-4 py-3 text-sm text-[#1b1b1b] shadow-[0_12px_28px_rgba(16,32,24,0.08)] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold text-[rgba(106,90,70,0.9)]">
              WhatsApp
              <input
                value={phone}
                onChange={(event)=>setPhone(event.target.value)}
                type="tel"
                placeholder="(16) 9 9999-9999"
                className="w-full rounded-[12px] border border-[rgba(27,94,74,0.18)] bg-white/90 px-4 py-3 text-sm text-[#1b1b1b] shadow-[0_12px_28px_rgba(16,32,24,0.08)] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-semibold text-[rgba(106,90,70,0.9)]">
              E-mail
              <span
                className={`relative block rounded-[12px] border border-[rgba(27,94,74,0.18)] bg-white/90 px-3 py-2 shadow-[0_12px_28px_rgba(16,32,24,0.08)] transition ${
                  isSuccess ? 'pointer-events-none opacity-75' : 'focus-within:border-[#2c8a6e] focus-within:ring-2 focus-within:ring-[#2c8a6e]/20'
                }`}
                aria-disabled={isSuccess}
              >
                <LinkAuthenticationElement options={linkOptions} onChange={handleLinkChange} />
                {isSuccess && <span className="pointer-events-none absolute inset-0 rounded-[12px] bg-white/50" aria-hidden="true" />}
              </span>
            </label>
            <label className="space-y-1 text-sm font-semibold text-[rgba(106,90,70,0.9)]">
              CPF (opcional)
              <input
                value={cpf}
                onChange={(event)=>setCpf(event.target.value)}
                type="text"
                placeholder="000.000.000-00"
                className="w-full rounded-[12px] border border-[rgba(27,94,74,0.18)] bg-white/90 px-4 py-3 text-sm text-[#1b1b1b] shadow-[0_12px_28px_rgba(16,32,24,0.08)] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20"
              />
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[rgba(106,90,70,0.9)]">Cupom de desconto</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={coupon}
                onChange={(event)=>{
                  setCoupon(event.target.value)
                  setCouponApplied(false)
                }}
                type="text"
                placeholder="BELEZA10"
                className="flex-1 rounded-[12px] border border-dashed border-[rgba(27,94,74,0.18)] bg-white/70 px-4 py-3 text-sm text-[#1b1b1b] shadow-[0_12px_24px_rgba(16,32,24,0.08)] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/16"
              />
              <button
                type="button"
                onClick={handleCouponApply}
                className="inline-flex items-center justify-center rounded-[12px] border border-dashed border-[#2c8a6e] px-5 py-3 text-sm font-semibold text-[#1b5e4a] transition hover:border-[#1b5e4a] hover:bg-[#f7f3ed]"
              >
                Aplicar
              </button>
            </div>
            {couponApplied && (
              <span className="text-xs font-medium text-[#1b5e4a]">Cupom aplicado!</span>
            )}
          </div>
        </section>

        <aside className="flex flex-col justify-between gap-6 rounded-[22px] border border-[rgba(44,138,110,0.18)] bg-white p-6 shadow-[0_30px_60px_rgba(16,32,24,0.12)] sm:p-8">
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-[#1b5e4a]">Pagamento</h2>
              <p className="text-sm leading-relaxed text-[rgba(106,90,70,0.85)]">
                Revise o resumo e escolha a forma de pagamento preferida.
              </p>
            </div>

            <div className="rounded-[18px] bg-[#f7f3ed] px-4 py-5 text-sm shadow-[inset_0_1px_0_rgba(27,94,74,0.08)] sm:px-5">
              <div className="flex items-center justify-between border-b border-dashed border-[rgba(106,90,70,0.25)] pb-3 text-[rgba(106,90,70,0.85)]">
                <span>Subtotal</span>
                <span className="font-semibold text-[#1b5e4a]">{formattedAmount ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-dashed border-[rgba(106,90,70,0.18)] py-3 text-[rgba(106,90,70,0.7)]">
                <span>Desconto</span>
                <span>{couponApplied ? coupon || 'Cupom aplicado' : '—'}</span>
              </div>
              <div className="flex items-center justify-between pt-3 text-base font-semibold text-[#1b5e4a]">
                <span>Total a pagar</span>
                <span>{formattedAmount ?? '—'}</span>
              </div>
            </div>

            {intent?.metadata?.payment_title && (
              <div className="rounded-[14px] border border-dashed border-[rgba(106,90,70,0.24)] bg-white/70 px-4 py-3 text-sm text-[rgba(106,90,70,0.85)]">
                <span className="block text-xs uppercase tracking-wide text-[rgba(106,90,70,0.7)]">Descrição</span>
                <span className="mt-1 block font-medium text-[#1b1b1b]">{intent.metadata.payment_title}</span>
              </div>
            )}

            {appointmentId && (
              <div className="rounded-[14px] border border-dashed border-[rgba(106,90,70,0.24)] bg-white/70 px-4 py-3 text-sm text-[rgba(106,90,70,0.85)]">
                <span className="block text-xs uppercase tracking-wide text-[rgba(106,90,70,0.7)]">Agendamento</span>
                <span className="mt-1 block font-semibold text-[#1b5e4a]">#{appointmentId}</span>
              </div>
            )}

            <div className="space-y-3">
              <span className="text-sm font-semibold text-[rgba(106,90,70,0.9)]">Forma de pagamento</span>
              <div className="rounded-[18px] border border-[rgba(27,94,74,0.18)] bg-white/90 p-3 shadow-[0_12px_28px_rgba(16,32,24,0.08)]">
                <PaymentElement options={paymentElementOptions} />
              </div>
            </div>

            {message && (
              <div
                className={`rounded-[16px] px-4 py-3 text-sm font-medium ${
                  isSuccess
                    ? 'border border-emerald-200 bg-emerald-50 text-[#1b5e4a]'
                    : status === 'error'
                      ? 'border border-red-200 bg-red-50 text-red-700'
                      : 'border border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {message}
              </div>
            )}

            <div className="flex items-start gap-3 rounded-[16px] border border-[rgba(27,94,74,0.16)] bg-white/80 px-4 py-3 text-[rgba(106,90,70,0.85)] shadow-[0_10px_22px_rgba(16,32,24,0.08)]">
              <span className="mt-0.5 text-lg">🔒</span>
              <p className="text-sm leading-relaxed">
                Pagamento processado com criptografia de ponta a ponta. Precisa de ajuda? Fale com a nossa equipe pelo WhatsApp.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={!stripe || !elements || isProcessing || isSuccess}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-gradient-to-br from-[#2c8a6e] to-[#1b5e4a] px-6 py-3 text-base font-semibold text-white shadow-[0_20px_40px_rgba(27,94,74,0.28)] transition hover:from-[#267a63] hover:to-[#184f3f] disabled:cursor-not-allowed disabled:from-[#aacfc1] disabled:to-[#aacfc1]"
          >
            {isProcessing ? 'Processando…' : isSuccess ? 'Pagamento concluído' : 'Pagar agora'}
          </button>
        </aside>
      </div>
    </form>
  )
}
