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

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <form
        onSubmit={handleSubmit}
        className="space-y-7 rounded-[22px] border border-[rgba(44,138,110,0.18)] bg-white/95 p-6 shadow-[0_30px_60px_rgba(16,32,24,0.12)] sm:p-8"
      >
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-[#1b5e4a]">Seus dados</h2>
          <p className="text-sm leading-relaxed text-[rgba(106,90,70,0.85)]">
            Preencha com atenção para receber a confirmação da sua compra e notificações sobre o agendamento.
          </p>
        </div>

        <div className="space-y-5">
          <label className="block text-sm font-semibold text-[rgba(106,90,70,0.9)]">
            E-mail para confirmação
            <span
              className={`relative mt-2 block rounded-[18px] border border-[rgba(27,94,74,0.18)] bg-white/80 p-2 shadow-[0_12px_28px_rgba(16,32,24,0.08)] transition ${
                isSuccess ? 'pointer-events-none opacity-75' : 'focus-within:border-[#2c8a6e] focus-within:ring-2 focus-within:ring-[#2c8a6e]/20'
              }`}
              aria-disabled={isSuccess}
            >
              <LinkAuthenticationElement options={linkOptions} onChange={handleLinkChange} />
              {isSuccess && (
                <span className="pointer-events-none absolute inset-0 rounded-[18px] bg-white/50" aria-hidden="true" />
              )}
            </span>
          </label>

          <div className="space-y-3">
            <span className="text-sm font-semibold text-[rgba(106,90,70,0.9)]">Forma de pagamento</span>
            <div className="rounded-[18px] border border-[rgba(27,94,74,0.18)] bg-white/80 p-3 shadow-[0_12px_28px_rgba(16,32,24,0.08)]">
              <PaymentElement options={paymentElementOptions} />
            </div>
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
      </form>

      <div className="space-y-5 rounded-[22px] border border-[rgba(44,138,110,0.18)] bg-[#f7f3ed]/90 p-6 shadow-[0_30px_60px_rgba(16,32,24,0.12)] sm:p-8">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-[#1b1b1b]">Resumo do pedido</h3>
          <p className="text-sm text-[rgba(106,90,70,0.85)]">
            Confira as informações antes de finalizar. O comprovante será enviado por e-mail.
          </p>
        </div>

        <dl className="space-y-4 text-sm text-[#1b1b1b]">
          {formattedAmount && (
            <div className="rounded-[18px] border border-[rgba(27,94,74,0.16)] bg-white px-4 py-3 shadow-[0_12px_24px_rgba(16,32,24,0.06)]">
              <div className="flex items-center justify-between text-[rgba(106,90,70,0.85)]">
                <dt>Subtotal</dt>
                <dd className="font-semibold text-[#1b5e4a]">{formattedAmount}</dd>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-wide text-[rgba(106,90,70,0.7)]">
                <span>Desconto</span>
                <span>—</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-base font-semibold text-[#1b5e4a]">
                <span>Total a pagar</span>
                <span>{formattedAmount}</span>
              </div>
            </div>
          )}

          {intent?.metadata?.payment_title && (
            <div className="flex items-start justify-between gap-3 border-b border-dashed border-[rgba(106,90,70,0.24)] pb-3">
              <dt className="text-[rgba(106,90,70,0.8)]">Descrição</dt>
              <dd className="text-right font-medium text-[#1b1b1b]">{intent.metadata.payment_title}</dd>
            </div>
          )}

          {appointmentId && (
            <div className="flex items-start justify-between gap-3 border-b border-dashed border-[rgba(106,90,70,0.24)] pb-3">
              <dt className="text-[rgba(106,90,70,0.8)]">Agendamento</dt>
              <dd className="font-semibold text-[#1b5e4a]">#{appointmentId}</dd>
            </div>
          )}

          {email && (
            <div className="flex items-start justify-between gap-3 border-b border-dashed border-[rgba(106,90,70,0.24)] pb-3">
              <dt className="text-[rgba(106,90,70,0.8)]">E-mail de contato</dt>
              <dd className="text-right text-[rgba(27,94,74,0.8)]">{email}</dd>
            </div>
          )}

          <div className="flex items-start gap-3 rounded-[18px] border border-[rgba(27,94,74,0.16)] bg-white/80 px-4 py-3 text-[rgba(106,90,70,0.85)] shadow-[0_10px_22px_rgba(16,32,24,0.08)]">
            <span className="mt-0.5 text-lg">🔒</span>
            <p className="text-sm leading-relaxed">
              Pagamento processado com criptografia de ponta a ponta. Precisa de ajuda? Fale com a nossa equipe pelo WhatsApp.
            </p>
          </div>
        </dl>
      </div>
    </div>
  )
}
