'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'

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
            {hasCheckout && (
              <div className="overflow-hidden rounded-3xl border border-[rgba(47,109,79,0.15)] bg-white shadow-[0_20px_55px_-25px_rgba(35,82,58,0.35)]">
                <EmbeddedCheckoutProvider stripe={stripePromise!} options={{ clientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
