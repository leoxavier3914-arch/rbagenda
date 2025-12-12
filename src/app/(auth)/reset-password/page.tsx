'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { LavaLampProvider } from '@/components/LavaLampProvider'
import {
  ClientGlassPanel,
  ClientPageShell,
  ClientSection,
} from '@/components/client/ClientPageLayout'
import { useClientPageReady } from '@/hooks/useClientPageReady'
import { supabase } from '@/lib/db'

import styles from './reset-password.module.css'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  const heroReady = useClientPageReady()
  const router = useRouter()

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data.session) {
          setError('Link inválido ou expirado. Solicite um novo para continuar.')
          setSessionReady(false)
        } else {
          setSessionReady(true)
        }
        setCheckingSession(false)
      })
      .catch(() => {
        if (!active) return
        setError('Não foi possível validar seu link. Solicite um novo e tente novamente.')
        setSessionReady(false)
        setCheckingSession(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    setMessage('')
    setError('')

    if (!sessionReady) {
      setError('Seu link parece inválido ou expirado. Solicite um novo para redefinir sua senha.')
      return
    }

    if (newPassword.length < 8) {
      setError('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas precisam ser iguais.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error('Erro ao atualizar senha', error)
      setError('Não foi possível atualizar sua senha. Solicite um novo link e tente novamente.')
      setLoading(false)
      return
    }

    setMessage('Senha atualizada com sucesso. Você já pode acessar sua conta.')
    setLoading(false)

    setTimeout(() => router.push('/login'), 1600)
  }

  const isDisabled = loading || checkingSession

  return (
    <LavaLampProvider>
      <ClientPageShell heroReady={heroReady} className={styles.shell}>
        <ClientSection className={styles.section}>
          <ClientGlassPanel className={styles.card} label="NOVA SENHA">
            <div className={styles.header}>
              <h1 className={styles.title}>Definir nova senha</h1>
              <p className={styles.subtitle}>
                Digite a nova senha que você quer usar para acessar sua conta.
              </p>
            </div>

            {checkingSession && (
              <div className={styles.info}>Validando seu link de redefinição...</div>
            )}

            <form className={styles.form} onSubmit={submit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="new-password">
                  Nova senha
                </label>
                <div className={styles.inputControl}>
                  <span aria-hidden className={styles.inputIcon}>
                    🔒
                  </span>
                  <input
                    id="new-password"
                    className={styles.input}
                    placeholder="Crie uma senha segura"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    type="password"
                    required
                    minLength={8}
                    disabled={isDisabled}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="confirm-password">
                  Confirmar nova senha
                </label>
                <div className={styles.inputControl}>
                  <span aria-hidden className={styles.inputIcon}>
                    ✅
                  </span>
                  <input
                    id="confirm-password"
                    className={styles.input}
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type="password"
                    required
                    minLength={8}
                    disabled={isDisabled}
                  />
                </div>
              </div>

              {error && <div className={styles.feedback}>{error}</div>}
              {message && <div className={styles.success}>{message}</div>}

              <button className={styles.submitButton} disabled={isDisabled}>
                {loading ? 'Atualizando…' : 'Atualizar senha'}
              </button>
            </form>

            <div className={styles.linkRow}>
              <Link href="/login" className={styles.link}>
                Ir para o login
              </Link>
            </div>
          </ClientGlassPanel>
        </ClientSection>
      </ClientPageShell>
    </LavaLampProvider>
  )
}
