'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { LavaLampProvider } from '@/components/LavaLampProvider'
import {
  ClientGlassPanel,
  ClientPageShell,
  ClientSection,
} from '@/components/client/ClientPageLayout'
import { useClientPageReady } from '@/hooks/useClientPageReady'
import { supabase } from '@/lib/db'

import styles from './confirm.module.css'

export default function ConfirmEmailPage() {
  const heroReady = useClientPageReady()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking')

  useEffect(() => {
    let active = true

    const resolveConfirmation = async () => {
      const code = searchParams.get('code') || searchParams.get('token_hash')

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            throw exchangeError
          }
        }

        const { data, error } = await supabase.auth.getSession()
        if (!active) return

        if (error || !data.session) {
          setStatus('error')
          return
        }

        setStatus('ok')
        router.replace('/meu-perfil')
      } catch (exchangeError) {
        console.error('Erro ao confirmar e-mail', exchangeError)
        if (active) {
          setStatus('error')
        }
      }
    }

    void resolveConfirmation()

    return () => {
      active = false
    }
  }, [router, searchParams])

  return (
    <LavaLampProvider>
      <ClientPageShell heroReady={heroReady}>
        <ClientSection className={styles.section}>
          <ClientGlassPanel label="CONFIRMAÇÃO DE E-MAIL">
            {status === 'checking' && (
              <p>Validando seu e-mail, aguarde...</p>
            )}

            {status === 'ok' && (
              <>
                <p>Seu e-mail foi confirmado com sucesso! Redirecionando para o seu perfil...</p>
                <p style={{ marginTop: 16 }}>
                  <Link href="/meu-perfil">Ir para o seu perfil</Link>
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <p>Não foi possível validar seu link de confirmação. Ele pode ter expirado.</p>
                <p style={{ marginTop: 16 }}>
                  <Link href="/login">Voltar para o login</Link>
                </p>
              </>
            )}
          </ClientGlassPanel>
        </ClientSection>
      </ClientPageShell>
    </LavaLampProvider>
  )
}
