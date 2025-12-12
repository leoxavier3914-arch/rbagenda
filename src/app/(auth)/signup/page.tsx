'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

import { LavaLampProvider } from '@/components/LavaLampProvider'
import {
  ClientGlassPanel,
  ClientPageHeader,
  ClientPageShell,
  ClientSection,
} from '@/components/client/ClientPageLayout'
import { useClientPageReady } from '@/hooks/useClientPageReady'
import { supabase } from '@/lib/db'

import styles from './signup.module.css'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [msg, setMsg] = useState('')

  const heroReady = useClientPageReady()

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/confirm`,
      },
    })
    if (error) return setMsg(error.message)

    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    const uid = session?.user.id || data.user?.id
    if (uid) {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ id: uid, email, full_name: fullName, whatsapp, role: 'client' }),
      })
    }

    setMsg('Verifique seu e-mail para confirmar o cadastro.')
  }

  return (
    <LavaLampProvider>
      <ClientPageShell heroReady={heroReady} className={styles.shell} forceMotion>
        <ClientSection className={styles.section}>
          <ClientGlassPanel className={styles.card} label="CADASTRO">
            <ClientPageHeader
              title="Criar conta"
              subtitle="Cadastre-se para reservar horários com praticidade e receber lembretes automáticos."
              hideDiamond
              className={styles.header}
              subtitleClassName={styles.subtitle}
            />

            <form className={styles.form} onSubmit={submit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="full_name">
                  Nome completo
                </label>
                <input
                  id="full_name"
                  className={`${styles.input} input-field`}
                  placeholder="Como devemos te chamar?"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="whatsapp">
                  WhatsApp (com DDD)
                </label>
                <input
                  id="whatsapp"
                  className={`${styles.input} input-field`}
                  placeholder="(00) 00000-0000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="signup-email">
                  E-mail
                </label>
                <input
                  id="signup-email"
                  className={`${styles.input} input-field`}
                  placeholder="nome@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="signup-password">
                  Senha
                </label>
                <input
                  id="signup-password"
                  className={`${styles.input} input-field`}
                  type="password"
                  placeholder="Crie uma senha segura"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button className={styles.submitButton}>Criar conta</button>
            </form>

            {msg && <div className={styles.feedback}>{msg}</div>}

            <p className={styles.linkRow}>
              Já tem uma conta?{' '}
              <Link href="/login" className={styles.link}>
                Entrar
              </Link>
            </p>
          </ClientGlassPanel>
        </ClientSection>
      </ClientPageShell>
    </LavaLampProvider>
  )
}
