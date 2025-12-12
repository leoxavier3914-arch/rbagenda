'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

import { LavaLampProvider } from '@/components/LavaLampProvider'
import {
  ClientGlassPanel,
  ClientPageShell,
  ClientSection,
} from '@/components/client/ClientPageLayout'
import { useClientPageReady } from '@/hooks/useClientPageReady'
import { supabase } from '@/lib/db'

import styles from './forgot-password.module.css'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const heroReady = useClientPageReady()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    setMessage('')
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    })

    if (error) {
      console.error('Erro ao solicitar recuperação de senha', error)
      setError('Não foi possível enviar o link. Verifique o e-mail e tente novamente em instantes.')
      setLoading(false)
      return
    }

    setMessage('Se existir uma conta com este e-mail, enviamos um link para redefinir sua senha.')
    setLoading(false)
  }

  return (
    <LavaLampProvider>
      <ClientPageShell heroReady={heroReady} className={styles.shell}>
        <ClientSection className={styles.section}>
          <ClientGlassPanel className={styles.card} label="RECUPERAR SENHA">
            <div className={styles.header}>
              <h1 className={styles.title}>Esqueceu sua senha?</h1>
              <p className={styles.subtitle}>
                Digite seu e-mail e enviaremos um link para você criar uma nova senha.
              </p>
            </div>

            <form className={styles.form} onSubmit={submit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="forgot-email">
                  E-mail
                </label>
                <div className={styles.inputControl}>
                  <span aria-hidden className={styles.inputIcon}>
                    ✉️
                  </span>
                  <input
                    id="forgot-email"
                    className={styles.input}
                    placeholder="nome@email.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {error && <div className={styles.feedback}>{error}</div>}
              {message && <div className={styles.success}>{message}</div>}

              <button className={styles.submitButton} disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar link de recuperação'}
              </button>
            </form>

            <div className={styles.linkRow}>
              <Link href="/login" className={styles.link}>
                Voltar para o login
              </Link>
            </div>
          </ClientGlassPanel>
        </ClientSection>
      </ClientPageShell>
    </LavaLampProvider>
  )
}
