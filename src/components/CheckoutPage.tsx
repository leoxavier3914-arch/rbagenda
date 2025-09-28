'use client'

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
import styles from './CheckoutPage.module.css'

type CheckoutPageProps = {
  clientSecret: string
  appointmentId?: string
}

export default function CheckoutPage({ clientSecret, appointmentId }: CheckoutPageProps) {
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
        fontSizeBase: '16px', // <- garante tipografia como no design
      },
      rules: {
        '.Input': {
          borderRadius: '14px',
          border: '1px solid rgba(44,138,110,0.20)',
          padding: '14px 16px',
          boxShadow: '0 12px 28px rgba(16,32,24,0.08)',
          backgroundColor: '#ffffff',
        },
        '.Input--invalid': { borderColor: '#dc2626' },

        '.Tab': {
          borderRadius: '14px',
          border: '2px solid #e3e3e3',
          padding: '12px 16px',
          backgroundColor: '#ffffff',
          boxShadow: '0 8px 18px rgba(44,138,110,0.08)',
        },
        '.Tab:hover': { borderColor: '#2c8a6e' },
        '.Tab--selected': {
          borderColor: '#2c8a6e',
          boxShadow: '0 8px 18px rgba(44,138,110,0.12)',
          backgroundImage: 'linear-gradient(135deg,#f7fdfb,#ffffff)',
          color: '#1b5e4a',
        },

        '.TabLabel': { fontSize: '15px', fontWeight: '600' }, // etiqueta das abas
        '.Block': { padding: '0' },
      },
    }),
    []
  )

  const elementsOptions: StripeElementsOptions | undefined = useMemo(() => {
    if (!clientSecret) return undefined
    return { clientSecret, appearance }
  }, [appearance, clientSecret])

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        {errorMessage && <div className={styles.errorBanner}>{errorMessage}</div>}

        {hasCheckout && elementsOptions && stripePromise && (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <ManualCheckoutForm appointmentId={appointmentId} clientSecret={clientSecret} />
          </Elements>
        )}

        <div className={styles.footerActions}>
          <button type="button" onClick={() => router.back()} className={styles.backButton}>
            ← Voltar
          </button>
        </div>
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

function ManualCheckoutForm({ appointmentId, clientSecret }: ManualCheckoutFormProps) {
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
  const [paymentMode, setPaymentMode] = useState<'pix' | 'card'>('card')
  const pixUnavailableMessage = 'A geração do QR Code Pix estará disponível em breve.'

  const paymentElementOptions: StripePaymentElementOptions = useMemo(
    () => ({ layout: 'tabs' }),
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
        if (paymentIntent.receipt_email) setEmail((prev) => prev || paymentIntent.receipt_email || '')
        if (paymentIntent.metadata?.customer_name) setFullName((prev) => prev || paymentIntent.metadata?.customer_name || '')
        if (paymentIntent.metadata?.customer_phone) setPhone((prev) => prev || paymentIntent.metadata?.customer_phone || '')
        setStatus(paymentIntent.status)
        if (paymentIntent.status === 'succeeded') setMessage('Pagamento confirmado com sucesso!')
        else if (paymentIntent.status === 'requires_payment_method') setMessage('Informe um método de pagamento para continuar.')
        else if (paymentIntent.status === 'processing') setMessage('Estamos processando o seu pagamento. Aguarde alguns instantes.')
        else if (paymentIntent.status === 'requires_action') setMessage('Conclua a autenticação adicional para finalizar o pagamento.')
        else setMessage(null)
      }
    })
    return () => { isMounted = false }
  }, [clientSecret, stripe])

  const formattedAmount = useMemo(() => {
    if (!intent?.amount || !intent.currency) return null
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: intent.currency.toUpperCase(),
    }).format(intent.amount / 100)
  }, [intent])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (paymentMode !== 'card') {
      setStatus('idle')
      setMessage(pixUnavailableMessage)
      return
    }

    if (!stripe || !elements) return

    setIsSubmitting(true)
    setStatus('processing')
    setMessage(null)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success?ref=${encodeURIComponent(appointmentId ?? '')}&session_id=${encodeURIComponent(intent?.id ?? '')}`,
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
        setTimeout(() => router.push('/dashboard/agendamentos'), 2000)
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
  const isCardMode = paymentMode === 'card'
  const isPixMode = paymentMode === 'pix'

  const isSubmitDisabled = !stripe || !elements || isProcessing || isSuccess || !isCardMode

  function handlePaymentModeChange(mode: 'pix' | 'card') {
    setPaymentMode(mode)
    if (mode === 'pix') {
      if (!isSuccess && status !== 'processing' && status !== 'error') {
        setMessage(pixUnavailableMessage)
      }
    } else if (message === pixUnavailableMessage && status === 'idle') {
      setMessage(null)
    }
  }

  return (
    <form id="form-checkout" onSubmit={handleSubmit} className={styles.form}>
      <section className={styles.card} aria-labelledby="checkout-customer-data">
        <header>
          <h2 id="checkout-customer-data" className={styles.cardTitle}>
            Seus dados
          </h2>
          <p className={styles.lead}>
            Informe seus dados para enviarmos a confirmação do pagamento e atualizações sobre o agendamento.
          </p>
        </header>

        <div className={`${styles.row} ${styles.rowCols2}`}>
          <label className={styles.field}>
            <span className={styles.labelText}>Nome completo</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex.: Agnes Romeike"
              type="text"
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.labelText}>WhatsApp</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(16) 9 9999-9999"
              type="tel"
              className={styles.input}
            />
          </label>
        </div>

        <div className={`${styles.row} ${styles.rowCols2}`}>
          <label className={styles.field}>
            <span className={styles.labelText}>E-mail</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              type="email"
              required
              className={styles.input}
              disabled={isSuccess}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.labelText}>CPF (opcional)</span>
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              type="text"
              className={styles.input}
            />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.labelText}>Cupom de desconto</span>
            <div className={styles.couponRow}>
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="BELEZA10"
                type="text"
                className={`${styles.input} ${styles.couponInput}`}
              />
              <button type="button" className={styles.btnSecondary} disabled>
                Aplicar
              </button>
            </div>
            <span className={styles.contactHint}>
              Insira um cupom válido se possuir. A validação ocorrerá automaticamente após o pagamento.
            </span>
          </label>
        </div>
      </section>

      <aside className={styles.card} aria-labelledby="checkout-payment-section">
        <header>
          <h2 id="checkout-payment-section" className={styles.cardTitle}>
            Pagamento
          </h2>
          <p className={styles.lead}>Revise o pedido, escolha a forma de pagamento e finalize com segurança.</p>
        </header>

        <div className={styles.summary} role="region" aria-label="Resumo do pedido">
          <div className={styles.line}>
            <span>Subtotal</span>
            <span>{formattedAmount ?? '—'}</span>
          </div>
          <div className={styles.line}>
            <span>Desconto</span>
            <span>—</span>
          </div>
          <div className={`${styles.line} ${styles.total}`}>
            <span>Total a pagar</span>
            <span>{formattedAmount ?? '—'}</span>
          </div>
        </div>

        {intent?.metadata?.payment_title && (
          <div className={styles.summaryDetail}>
            <span>Descrição</span>
            <span>{intent.metadata.payment_title}</span>
          </div>
        )}

        {appointmentId && (
          <div className={styles.summaryDetail}>
            <span>Agendamento</span>
            <span>#{appointmentId}</span>
          </div>
        )}

        {email && (
          <div className={styles.summaryDetail}>
            <span>E-mail de contato</span>
            <span>{email}</span>
          </div>
        )}

        <div className={styles.row} role="radiogroup" aria-label="Forma de pagamento">
          <label className={`${styles.payOption} ${isPixMode ? styles.payOptionActive : ''}`}>
            <div>
              <div className={styles.payLabel}>Pix</div>
              <div className={styles.payHint}>Confirmação rápida após pagamento</div>
            </div>
            <span className={styles.pill}>Recomendado</span>
            <input
              type="radio"
              name="payment-mode"
              value="pix"
              checked={isPixMode}
              onChange={() => handlePaymentModeChange('pix')}
            />
          </label>

          <label className={`${styles.payOption} ${isCardMode ? styles.payOptionActive : ''}`}>
            <div>
              <div className={styles.payLabel}>Cartão de crédito</div>
              <div className={styles.payHint}>Principais bandeiras aceitas</div>
            </div>
            <span className={styles.pill}>Em até 12x</span>
            <input
              type="radio"
              name="payment-mode"
              value="card"
              checked={isCardMode}
              onChange={() => handlePaymentModeChange('card')}
            />
          </label>
        </div>

        {isCardMode ? (
          <div className={styles.paymentBox}>
            <PaymentElement options={paymentElementOptions} />
          </div>
        ) : (
          <div className={styles.pixBox}>
            <span className={styles.pixTitle}>Pagamento via Pix</span>
            <p>
              Em breve você poderá gerar o QR Code automaticamente por aqui. Enquanto isso, selecione “Pagar agora” para ser notificado
              assim que a funcionalidade estiver disponível.
            </p>
            <button
              type="button"
              className={styles.pixButton}
              onClick={() => setMessage(pixUnavailableMessage)}
            >
              Pagar agora
            </button>
          </div>
        )}

        {message && (
          <div
            className={`${
              styles.message
            } ${isSuccess ? styles.messageSuccess : status === 'error' ? styles.messageError : styles.messageInfo}`}
          >
            {message}
          </div>
        )}

        {isCardMode && (
          <button type="submit" disabled={isSubmitDisabled} className={styles.btn}>
            {isProcessing ? 'Processando…' : isSuccess ? 'Pagamento concluído' : 'Pagar agora'}
          </button>
        )}

        <div className={styles.securityBox}>
          <span className={styles.securityIcon}>🔒</span>
          <p>
            Pagamento processado com criptografia de ponta a ponta. Precisa de ajuda? Fale com a nossa equipe pelo WhatsApp.
          </p>
        </div>
      </aside>
    </form>
  )
}
