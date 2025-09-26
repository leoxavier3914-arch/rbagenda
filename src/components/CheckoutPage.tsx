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
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 py-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="relative isolate overflow-hidden rounded-[32px] border border-[rgba(35,82,58,0.12)] bg-[#fdf9f0]/90 shadow-[0_25px_60px_-25px_rgba(35,82,58,0.35)] backdrop-blur">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-[rgba(47,109,79,0.12)] via-transparent to-[rgba(35,82,58,0.18)]" aria-hidden="true" />
          <div className="flex flex-col gap-8 p-8 sm:p-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(47,109,79,0.15)] bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#2f6d4f]">
                  Pagamento seguro
                </span>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold text-[#1f2d28] sm:text-3xl">Conclua o seu pagamento</h1>
                  <p className="text-sm text-[color:rgba(31,45,40,0.72)]">
                    Revise os dados do agendamento e finalize o pagamento com a segurança da Stripe.
                  </p>
                  {appointmentId && (
                    <p className="text-xs uppercase tracking-wide text-[color:rgba(31,45,40,0.55)]">
                      Agendamento <span className="font-semibold text-[#2f6d4f]">#{appointmentId}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={()=>router.back()}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(47,109,79,0.2)] bg-white/80 px-4 py-2 text-sm font-medium text-[#2f6d4f] transition hover:border-[#2f6d4f] hover:bg-[#f7f2e7]"
                >
                  ← Voltar
                </button>
                <Link
                  href="/dashboard/agendamentos"
                  className="text-xs font-medium text-[color:rgba(31,45,40,0.6)] underline-offset-4 hover:underline"
                >
                  Ver agendamentos
                </Link>
              </div>
            </div>
            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
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
      </div>
    </div>
  )
}

type ManualCheckoutFormProps = {
  appointmentId?: string
  clientSecret: string
}

function ManualCheckoutForm({ appointmentId, clientSecret }: ManualCheckoutFormProps){
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<PaymentIntent['status'] | 'idle' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [intent, setIntent] = useState<PaymentIntent | null>(null)

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
      const paymentIntent = result.paymentIntent ?? null
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
      setIntent(paymentIntent)
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
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-[rgba(47,109,79,0.15)] bg-white/80 p-6 shadow-[0_20px_55px_-25px_rgba(35,82,58,0.25)]">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#1f2d28]">Dados de pagamento</h2>
          <p className="text-sm text-[color:rgba(31,45,40,0.68)]">
            Utilize um cartão válido ou outra forma de pagamento disponível. Todo o processo é criptografado e seguro.
          </p>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-[#1f2d28]">
            E-mail para confirmação
            <span className="mt-1 block rounded-2xl border border-[rgba(47,109,79,0.15)] bg-white/70 p-2">
              <LinkAuthenticationElement options={linkOptions} onChange={handleLinkChange} disabled={isSuccess} />
            </span>
          </label>
          <div className="space-y-2">
            <span className="text-sm font-medium text-[#1f2d28]">Forma de pagamento</span>
            <div className="rounded-2xl border border-[rgba(47,109,79,0.15)] bg-white/70 p-2">
              <PaymentElement options={paymentElementOptions} />
            </div>
          </div>
        </div>
        {message && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              isSuccess
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#2f6d4f] px-6 py-3 text-base font-semibold text-white shadow-[0_15px_30px_-15px_rgba(35,82,58,0.55)] transition hover:bg-[#285d43] disabled:cursor-not-allowed disabled:bg-[rgba(47,109,79,0.45)]"
        >
          {isProcessing ? 'Processando…' : isSuccess ? 'Pagamento concluído' : 'Pagar agora'}
        </button>
      </form>
      <div className="space-y-4 rounded-3xl border border-[rgba(47,109,79,0.15)] bg-white/70 p-6 shadow-[0_20px_55px_-25px_rgba(35,82,58,0.2)]">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-[#1f2d28]">Resumo</h3>
          <p className="text-sm text-[color:rgba(31,45,40,0.68)]">
            A confirmação do pagamento será enviada para o seu e-mail assim que a Stripe finalizar o processamento.
          </p>
        </div>
        <dl className="space-y-3 text-sm text-[#1f2d28]">
          {formattedAmount && (
            <div className="flex items-center justify-between rounded-2xl border border-[rgba(47,109,79,0.12)] bg-[#f5f0e6]/80 px-4 py-3">
              <dt className="font-medium text-[color:rgba(31,45,40,0.7)]">Valor a pagar</dt>
              <dd className="text-base font-semibold text-[#2f6d4f]">{formattedAmount}</dd>
            </div>
          )}
          {intent?.metadata?.payment_title && (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-[color:rgba(31,45,40,0.7)]">Descrição</dt>
              <dd className="font-medium text-right text-[#1f2d28]">{intent.metadata.payment_title}</dd>
            </div>
          )}
          {appointmentId && (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-[color:rgba(31,45,40,0.7)]">Agendamento</dt>
              <dd className="font-semibold text-[#2f6d4f]">#{appointmentId}</dd>
            </div>
          )}
          {email && (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-[color:rgba(31,45,40,0.7)]">E-mail de contato</dt>
              <dd className="text-right text-[color:rgba(31,45,40,0.85)]">{email}</dd>
            </div>
          )}
          <div className="flex items-start gap-3 rounded-2xl border border-[rgba(47,109,79,0.12)] bg-white/70 px-4 py-3 text-[color:rgba(31,45,40,0.68)]">
            <span className="mt-0.5 text-lg">🔒</span>
            <p className="text-sm leading-relaxed">
              Seus dados estão protegidos com criptografia de ponta a ponta. Em caso de dúvidas, fale com a nossa equipe pelo WhatsApp.
            </p>
          </div>
        </dl>
      </div>
    </div>
  )
}
