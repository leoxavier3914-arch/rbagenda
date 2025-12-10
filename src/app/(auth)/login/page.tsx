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
import { supabase } from '@/lib/db'

import styles from './login.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()

  const redirectByRole = useCallback(
    async (session: Session | null) => {
      if (!session?.user?.id) return

      router.replace('/meu-perfil')
    },
    [router],
  )

  useEffect(() => {
    let active = true

    async function verifySession() {
      const { data } = await supabase.auth.getSession()
      if (!active) return

      if (data.session) {
        redirectByRole(data.session)
        return
      }

      setCheckingSession(false)
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
      setMsg(error.message)
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
      <ClientPageShell className={styles.shell}>
        <ClientSection className={styles.section}>
          <ClientGlassPanel className={styles.card} label="LOGIN">
            <div className={styles.logoBlock}>
              <div className={styles.logoBadge}>ROMEIKE BEAUTY</div>
              <p className={styles.logoSubtitle}>
                Acesse para acompanhar seus agendamentos e novidades.
              </p>
            </div>

            {checkingSession ? (
              <div className={styles.sessionMessage}>Verificando sessão…</div>
            ) : (
              <>
                <form className={styles.form} onSubmit={submit}>
                  <div className={styles.field}>
                    <label
                      className={styles.label}
                      htmlFor="email"
                    >
                      E-mail
                    </label>
                    <input
                      id="email"
                      className={`input-field ${styles.input}`}
                      placeholder="nome@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className={styles.field}>
                    <label
                      className={styles.label}
                      htmlFor="password"
                    >
                      Senha
                    </label>
                    <input
                      id="password"
                      className={`input-field ${styles.input}`}
                      type="password"
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <div className={styles.helpRow}>
                      <span>Esqueceu sua senha?</span>
                      <Link href="#" className={styles.link}>
                        Clique aqui
                      </Link>
                    </div>
                  </div>

                  {msg && (
                    <div className={styles.feedback}>{msg}</div>
                  )}

                  <button className="btn-primary w-full" disabled={loading}>
                    {loading ? 'Entrando…' : 'Entrar'}
                  </button>
                </form>

                <p className={styles.signupText}>
                  Ainda não tem uma conta?{' '}
                  <Link href="/signup" className={styles.link}>
                    Criar conta
                  </Link>
                </p>
              </>
            )}
          </ClientGlassPanel>
        </ClientSection>
      </ClientPageShell>
    </LavaLampProvider>
  )
}
