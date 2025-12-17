'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

import { LavaLampProvider } from '@/components/LavaLampProvider'
import {
  ClientGlassPanel,
  ClientPageShell,
  ClientSection,
} from '@/components/client/ClientPageLayout'
import { useClientPageReady } from '@/hooks/useClientPageReady'
import { supabase } from '@/lib/db'

import styles from './login.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()
  const heroReady = useClientPageReady()

  const isFormDisabled = loading || checkingSession

  const resolveRedirectPath = useCallback(async (session: Session | null) => {
    if (!session?.user?.id) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()

    if (error) {
      console.error('Erro ao descobrir role do usuário', error)
      return null
    }

    if (data?.role === 'admin' || data?.role === 'adminsuper' || data?.role === 'adminmaster') {
      return '/admin'
    }

    return '/meu-perfil'
  }, [])

  const redirectByRole = useCallback(async (session: Session | null) => {
    if (!session?.user?.id) return

    const redirectPath = await resolveRedirectPath(session)

    router.replace(redirectPath ?? '/meu-perfil')
  }, [resolveRedirectPath, router])

  useEffect(() => {
    let active = true

    async function verifySession() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!active) return

        if (data.session) {
          redirectByRole(data.session)
          return
        }

        setCheckingSession(false)
      } catch (error) {
        if (!active) return

        console.error('Erro ao verificar sessão', error)
        setMsg('Não foi possível verificar a sessão. Tente novamente.')
        setCheckingSession(false)
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session) {
        redirectByRole(session)
      } else {
        setCheckingSession(false)
      }
    })

    verifySession()

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [redirectByRole])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setMsg('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const msg = error.message.toLowerCase()

      if (msg.includes('confirm') || msg.includes('not confirmed')) {
        setMsg('Seu e-mail ainda não foi confirmado. Abra o link enviado ao seu e-mail antes de entrar.')
      } else {
        setMsg(error.message)
      }

      setLoading(false)
      return
    }

    if (data.session) {
      await redirectByRole(data.session)
    } else {
      setMsg('Sessão não disponível. Verifique seu acesso e tente novamente.')
    }

    setLoading(false)
  }

  return (
    <LavaLampProvider>
      <ClientPageShell heroReady={heroReady} className={styles.shell}>
        <ClientSection className={styles.section}>
          <div className={styles.logoArea}>
            <div className={styles.logoBadge}>ROMEIKE BEAUTY</div>
          </div>

          <ClientGlassPanel className={styles.card} label="LOGIN">
            {checkingSession && (
              <div className={styles.sessionInfo}>
                Validando sessão ativa. O formulário ficará disponível em instantes.
              </div>
            )}

            <form className={styles.form} onSubmit={submit}>
              <div className={styles.field}>
                <label
                  className={`${styles.label} ${styles.visuallyHidden}`}
                  htmlFor="email"
                >
                  E-mail
                </label>
                <div className={styles.inputControl}>
                  <span aria-hidden className={styles.inputIcon}>
                    ✉️
                  </span>
                  <input
                    id="email"
                    className={styles.input}
                    placeholder="nome@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label
                  className={`${styles.label} ${styles.visuallyHidden}`}
                  htmlFor="password"
                >
                  Senha
                </label>
                <div className={styles.inputControl}>
                  <span aria-hidden className={styles.inputIcon}>
                    🔒
                  </span>
                  <input
                    id="password"
                    className={styles.input}
                    type="password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>

              {msg && <div className={styles.feedback}>{msg}</div>}

              <button className={styles.submitButton} disabled={isFormDisabled}>
                {loading ? 'Entrando…' : 'Entrar'}
              </button>

              <div className={styles.helpRow}>
                <Link href="/forgot-password" className={styles.link}>
                  Esqueci minha senha
                </Link>
              </div>
            </form>

            <p className={styles.signupText}>
              Ainda não tem uma conta?{' '}
              <Link href="/signup" className={styles.link}>
                Criar conta
              </Link>
            </p>
          </ClientGlassPanel>
        </ClientSection>
      </ClientPageShell>
    </LavaLampProvider>
  )
}
