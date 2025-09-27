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
        fontSizeBase: '16px',
      },
      rules: {
        '.Input': {
          borderRadius: '12px',
          border: '1px solid #dddddd',
          padding: '13px 16px',
          boxShadow: 'none',
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
          color: '#6a5a46',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        '.Tab:hover': {
          borderColor: '#2c8a6e',
        },
        '.Tab--selected': {
          borderColor: '#2c8a6e',
          boxShadow: '0 8px 18px rgba(44,138,110,0.12)',
          backgroundImage: 'linear-gradient(135deg,#f7fdfb,#ffffff)',
          color: '#1b5e4a',
        },
        '.TabLabel': {
          fontSize: '15px',
        },
        '.Block': {
          padding: '0',
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
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#faf9f6_45%,_#f5f0e6_100%)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1050px]">
        <div className="mb-6 flex items-center justify-between text-sm text-[#6a5a46]">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full border border-[#d6e6df] bg-white px-4 py-2 font-medium text-[#1b5e4a] shadow-[0_10px_25px_rgba(16,32,24,0.08)] transition hover:border-[#1b5e4a] hover:text-[#1b5e4a]"
          >
            ← Voltar
          </button>
          <Link
            href="/dashboard/agendamentos"
            className="font-medium underline-offset-4 hover:text-[#1b5e4a] hover:underline"
          >
            Ver agendamentos
          </Link>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-[18px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 shadow-[0_12px_28px_rgba(220,38,38,0.12)]">
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
      className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"
    >
      <section className="space-y-6 rounded-[22px] bg-white p-6 shadow-[0_30px_60px_rgba(16,32,24,0.14)] sm:p-8">
        <header className="space-y-1">
          <h2 className="text-[26px] font-semibold text-[#1b5e4a]">Seus dados</h2>
          <p className="text-[15px] leading-relaxed text-[#6a5a46]">
            Informe seus dados para enviarmos a confirmação do pagamento e atualizações sobre o agendamento.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-[15px] font-semibold text-[#6a5a46]">
            Nome completo
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Ex.: Agnes Romeike"
              type="text"
              className="rounded-[12px] border border-[#dddddd] px-4 py-3.5 text-[16px] font-normal text-[#1b1b1b] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-[15px] font-semibold text-[#6a5a46]">
            WhatsApp
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(16) 9 9999-9999"
              type="tel"
              className="rounded-[12px] border border-[#dddddd] px-4 py-3.5 text-[16px] font-normal text-[#1b1b1b] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-[15px] font-semibold text-[#6a5a46]">
            E-mail
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
              type="email"
              required
              className={`rounded-[12px] border border-[#dddddd] px-4 py-3.5 text-[16px] font-normal text-[#1b1b1b] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20 ${
                isSuccess ? 'pointer-events-none opacity-75' : ''
              }`}
              disabled={isSuccess}
            />
          </label>

          <label className="flex flex-col gap-2 text-[15px] font-semibold text-[#6a5a46]">
            CPF (opcional)
            <input
              value={cpf}
              onChange={(event) => setCpf(event.target.value)}
              placeholder="000.000.000-00"
              type="text"
              className="rounded-[12px] border border-[#dddddd] px-4 py-3.5 text-[16px] font-normal text-[#1b1b1b] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20"
            />
          </label>
        </div>

        <div className="space-y-3">
          <span className="text-[15px] font-semibold text-[#6a5a46]">Cupom de desconto</span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={coupon}
              onChange={(event) => setCoupon(event.target.value)}
              placeholder="BELEZA10"
              type="text"
              className="flex-1 rounded-[12px] border border-[#dddddd] px-4 py-3.5 text-[16px] font-normal text-[#1b1b1b] outline-none transition focus:border-[#2c8a6e] focus:ring-2 focus:ring-[#2c8a6e]/20"
            />
            <button
              type="button"
              className="rounded-[12px] border border-dashed border-[#2c8a6e] px-5 py-3 text-[15px] font-semibold text-[#1b5e4a] transition hover:border-[#1b5e4a] hover:text-[#1b5e4a]"
              disabled
            >
              Aplicar
            </button>
          </div>
          <p className="text-xs text-[#8d7b64]">
            Insira um cupom válido se possuir. A validação ocorrerá automaticamente após o pagamento.
          </p>
        </div>
      </section>

      <aside className="space-y-6 rounded-[22px] bg-white p-6 shadow-[0_30px_60px_rgba(16,32,24,0.14)] sm:p-8">
        <header className="space-y-1">
          <h2 className="text-[26px] font-semibold text-[#6a5a46]">Pagamento</h2>
          <p className="text-[15px] leading-relaxed text-[#6a5a46]">
            Revise o pedido, selecione a forma de pagamento desejada e finalize com segurança.
          </p>
        </header>

        <section className="rounded-[22px] bg-[#f7f3ed] p-5">
          <div className="space-y-3 rounded-[18px] bg-white px-5 py-4 shadow-[0_18px_36px_rgba(16,32,24,0.08)]">
            <div className="flex items-center justify-between text-[15px] text-[#6a5a46]">
              <span>Subtotal</span>
              <span>{formattedAmount ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between border-y border-dashed border-[#d9cfc2] py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8d7b64]">
              <span>Desconto</span>
              <span>—</span>
            </div>
            <div className="flex items-center justify-between text-[18px] font-extrabold text-[#1b5e4a]">
              <span>Total a pagar</span>
              <span>{formattedAmount ?? '—'}</span>
            </div>
          </div>

          {intent?.metadata?.payment_title && (
            <div className="mt-4 flex items-start justify-between gap-4 text-[15px] text-[#6a5a46]">
              <span>Descrição</span>
              <span className="text-right font-medium text-[#1b1b1b]">{intent.metadata.payment_title}</span>
            </div>
          )}

          {appointmentId && (
            <div className="mt-2 flex items-start justify-between gap-4 text-[15px] text-[#6a5a46]">
              <span>Agendamento</span>
              <span className="font-semibold text-[#1b5e4a]">#{appointmentId}</span>
            </div>
          )}

          {email && (
            <div className="mt-2 flex items-start justify-between gap-4 text-[15px] text-[#6a5a46]">
              <span>E-mail de contato</span>
              <span className="text-right text-[#1b5e4a]">{email}</span>
            </div>
          )}
        </section>

        <div className="space-y-3">
          <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#6a5a46]">Forma de pagamento</span>
          <div className="rounded-[18px] border-2 border-[#e3e3e3] bg-white p-4 shadow-[0_12px_28px_rgba(16,32,24,0.08)]">
            <PaymentElement options={paymentElementOptions} />
          </div>
        </div>

        {message && (
          <div
            className={`rounded-[14px] px-4 py-3 text-[15px] font-medium ${
              isSuccess
                ? 'border border-[#b7e4d5] bg-[#e8f7f1] text-[#1b5e4a]'
                : status === 'error'
                  ? 'border border-red-200 bg-red-50 text-red-700'
                  : 'border border-[#f7e5b5] bg-[#fff8e1] text-[#7a5a1a]'
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={!stripe || !elements || isProcessing || isSuccess}
          className="inline-flex w-full items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#2c8a6e,#1b5e4a)] px-6 py-3.5 text-[16px] font-semibold text-white shadow-[0_20px_40px_rgba(27,94,74,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isProcessing ? 'Processando…' : isSuccess ? 'Pagamento concluído' : 'Pagar agora'}
        </button>
      </aside>
    </form>
  )
}
