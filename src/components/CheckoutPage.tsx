'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import type {
  Appearance,
  PaymentIntent,
  StripeElementsOptions,
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
        colorPrimary: '#2c8a6e',
        colorBackground: '#ffffff',
        colorText: '#1b1b1b',
        colorDanger: '#dc2626',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontLineHeight: '1.5',
        borderRadius: '14px',
      },
      rules: {
        '.Input': {
          borderRadius: '14px',
          border: '1px solid rgba(44,138,110,0.2)',
          padding: '14px 16px',
          boxShadow: '0 12px 28px rgba(16, 32, 24, 0.08)',
          backgroundColor: '#ffffff',
        },
        '.Input--invalid': {
          borderColor: '#dc2626',
        },
        '.Tab': {
          borderRadius: '14px',
          border: '2px solid #e3e3e3',
          padding: '12px 16px',
          backgroundColor: '#ffffff',
          boxShadow: '0 8px 18px rgba(44,138,110,0.08)',
        },
        '.Tab:hover': {
          borderColor: '#2c8a6e',
        },
        '.Tab--selected': {
          borderColor: '#2c8a6e',
          boxShadow: '0 8px 18px rgba(44,138,110,0.12)',
          backgroundImage: 'linear-gradient(135deg,#f7fdfb,#ffffff)',
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
    <div className="relative min-h-screen w-full bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#faf9f6_52%,_#f5f0e6_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-white/90 via-white/40 to-transparent" aria-hidden="true" />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="mx-auto w-full max-w-4xl overflow-hidden rounded-[32px] border border-[rgba(35,82,58,0.12)] bg-white/80 shadow-[0_30px_60px_rgba(16,32,24,0.14)] backdrop-blur">
          <div className="bg-gradient-to-br from-[rgba(27,94,74,0.08)] via-transparent to-[rgba(27,94,74,0.14)] px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(27,94,74,0.24)] bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#1b5e4a]">
                  Pagamento seguro
                </span>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold text-[#1b1b1b] sm:text-[34px]">Finalize seu checkout</h1>
                  <p className="max-w-xl text-sm leading-relaxed text-[rgba(106,90,70,0.85)]">
                    Confirme os dados do agendamento, selecione a forma de pagamento desejada e conclua a compra com total segurança.
                  </p>
                  {appointmentId && (
                    <p className="text-xs font-medium uppercase tracking-wide text-[rgba(27,94,74,0.75)]">
                      Agendamento <span className="font-semibold text-[#1b5e4a]">#{appointmentId}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 text-sm">
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
          </div>
          {errorMessage && (
            <div className="border-t border-[rgba(27,94,74,0.12)] bg-red-50/90 px-6 py-4 text-sm text-red-700 sm:px-10">
              {errorMessage}
            </div>
          )}
        </header>

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

  const paymentElementOptions: StripePaymentElementOptions = useMemo(
    () => ({
      layout: 'tabs',
    }),
    []
  )

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
        if (paymentIntent.metadata?.customer_name) {
          setFullName((prev) => prev || paymentIntent.metadata?.customer_name || '')
        }
        if (paymentIntent.metadata?.customer_phone) {
          setPhone((prev) => prev || paymentIntent.metadata?.customer_phone || '')
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
        receipt_email: email || undefined,
        payment_method_data: {
          billing_details: {
            name: fullName || undefined,
            email: email || undefined,
            phone: phone || undefined,
          },
        },
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

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
    >
      <section className="space-y-6 rounded-[22px] border border-[rgba(44,138,110,0.16)] bg-white/95 p-6 shadow-[0_30px_60px_rgba(16,32,24,0.12)] sm:p-8">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold text-[#1b5e4a]">Seus dados</h2>
          <p className="text-sm leading-relaxed text-[rgba(106,90,70,0.85)]">
            Informe seus dados para enviarmos a confirmação do pagamento e atualizações sobre o agendamento.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-[rgba(106,90,70,0.85)]">
            Nome completo
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Ex.: Agnes Romeike"
              type="text"
              className="rounded-[12px] border border-[rgba(27,94,74,0.16)] bg-white px-4 py-3 text-[15px] font-normal text-[#1b1b1b] shadow-[0_12px_28px_rgba(16,32,24,0.08)] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-[rgba(106,90,70,0.85)]">
            WhatsApp
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(16) 9 9999-9999"
              type="tel"
              className="rounded-[12px] border border-[rgba(27,94,74,0.16)] bg-white px-4 py-3 text-[15px] font-normal text-[#1b1b1b] shadow-[0_12px_28px_rgba(16,32,24,0.08)] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-[rgba(106,90,70,0.85)]">
            E-mail
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
              type="email"
              required
              className={`rounded-[12px] border border-[rgba(27,94,74,0.16)] bg-white px-4 py-3 text-[15px] font-normal text-[#1b1b1b] shadow-[0_12px_28px_rgba(16,32,24,0.08)] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20 ${
                isSuccess ? 'pointer-events-none opacity-75' : ''
              }`}
              disabled={isSuccess}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-[rgba(106,90,70,0.85)]">
            CPF (opcional)
            <input
              value={cpf}
              onChange={(event) => setCpf(event.target.value)}
              placeholder="000.000.000-00"
              type="text"
              className="rounded-[12px] border border-[rgba(27,94,74,0.16)] bg-white px-4 py-3 text-[15px] font-normal text-[#1b1b1b] shadow-[0_12px_28px_rgba(16,32,24,0.08)] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20"
            />
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-semibold text-[rgba(106,90,70,0.85)]">Cupom de desconto</span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={coupon}
              onChange={(event) => setCoupon(event.target.value)}
              placeholder="BELEZA10"
              type="text"
              className="flex-1 rounded-[12px] border border-[rgba(27,94,74,0.16)] bg-white px-4 py-3 text-[15px] font-normal text-[#1b1b1b] shadow-[0_12px_28px_rgba(16,32,24,0.08)] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20"
            />
            <button
              type="button"
              className="rounded-[12px] border border-dashed border-[#2c8a6e] px-5 py-3 text-sm font-semibold text-[#1b5e4a] transition hover:border-[#1b5e4a] hover:text-[#1b5e4a]"
              disabled
            >
              Aplicar
            </button>
          </div>
          <p className="text-xs text-[rgba(106,90,70,0.7)]">
            Insira um cupom válido se possuir. A validação ocorrerá automaticamente após o pagamento.
          </p>
        </div>
      </section>

      <aside className="space-y-6 rounded-[22px] border border-[rgba(44,138,110,0.18)] bg-[#f7f3ed] p-6 shadow-[0_30px_60px_rgba(16,32,24,0.12)] sm:p-8">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold text-[#6a5a46]">Pagamento</h2>
          <p className="text-sm text-[rgba(106,90,70,0.85)]">
            Revise o pedido, selecione a forma de pagamento desejada e finalize com segurança.
          </p>
        </header>

        <section className="rounded-[22px] bg-[#f7f3ed]/60 p-4">
          <div className="space-y-3 rounded-[18px] border border-[rgba(27,94,74,0.14)] bg-white px-5 py-4 shadow-[0_18px_36px_rgba(16,32,24,0.08)]">
            <div className="flex items-center justify-between text-sm text-[rgba(106,90,70,0.8)]">
              <span>Subtotal</span>
              <span>{formattedAmount ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between border-y border-dashed border-[rgba(106,90,70,0.2)] py-2 text-xs uppercase tracking-[0.12em] text-[rgba(106,90,70,0.65)]">
              <span>Desconto</span>
              <span>—</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-[#1b5e4a]">
              <span>Total a pagar</span>
              <span>{formattedAmount ?? '—'}</span>
            </div>
          </div>

          {intent?.metadata?.payment_title && (
            <div className="mt-4 flex items-start justify-between gap-4 text-sm text-[rgba(106,90,70,0.8)]">
              <span>Descrição</span>
              <span className="text-right font-medium text-[#1b1b1b]">{intent.metadata.payment_title}</span>
            </div>
          )}

          {appointmentId && (
            <div className="mt-2 flex items-start justify-between gap-4 text-sm text-[rgba(106,90,70,0.8)]">
              <span>Agendamento</span>
              <span className="font-semibold text-[#1b5e4a]">#{appointmentId}</span>
            </div>
          )}

          {email && (
            <div className="mt-2 flex items-start justify-between gap-4 text-sm text-[rgba(106,90,70,0.8)]">
              <span>E-mail de contato</span>
              <span className="text-right text-[#1b5e4a]">{email}</span>
            </div>
          )}
        </section>

        <div className="space-y-3">
          <span className="text-sm font-semibold uppercase tracking-[0.16em] text-[rgba(106,90,70,0.85)]">Forma de pagamento</span>
          <div className="rounded-[18px] border border-[rgba(27,94,74,0.16)] bg-white p-4 shadow-[0_12px_28px_rgba(16,32,24,0.08)]">
            <PaymentElement options={paymentElementOptions} />
          </div>
        </div>

        {message && (
          <div
            className={`rounded-[18px] px-4 py-3 text-sm font-medium ${
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

        <button
          type="submit"
          disabled={!stripe || !elements || isProcessing || isSuccess}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-gradient-to-br from-[#2c8a6e] to-[#1b5e4a] px-6 py-3 text-base font-semibold text-white shadow-[0_20px_40px_rgba(27,94,74,0.28)] transition hover:from-[#267a63] hover:to-[#184f3f] disabled:cursor-not-allowed disabled:from-[#aacfc1] disabled:to-[#aacfc1]"
        >
          {isProcessing ? 'Processando…' : isSuccess ? 'Pagamento concluído' : 'Pagar agora'}
        </button>

        <div className="flex items-start gap-3 rounded-[18px] border border-[rgba(27,94,74,0.16)] bg-white/80 px-4 py-3 text-[rgba(106,90,70,0.85)] shadow-[0_10px_22px_rgba(16,32,24,0.08)]">
          <span className="mt-0.5 text-lg">🔒</span>
          <p className="text-sm leading-relaxed">
            Pagamento processado com criptografia de ponta a ponta. Precisa de ajuda? Fale com a nossa equipe pelo WhatsApp.
          </p>
        </div>
      </aside>
    </form>
  )
}
