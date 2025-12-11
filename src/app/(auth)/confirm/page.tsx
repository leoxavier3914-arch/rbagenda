'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { LavaLampProvider } from '@/components/LavaLampProvider'
import {
  ClientGlassPanel,
  ClientPageShell,
  ClientSection,
} from '@/components/client/ClientPageLayout'
import { useClientPageReady } from '@/hooks/useClientPageReady'
import { supabase } from '@/lib/db'

type Status = 'checking' | 'ok' | 'error'

export default function ConfirmEmailPage() {
  const heroReady = useClientPageReady()
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (error) {
          setStatus('error')
          return
        }
        if (data.user) {
          setStatus('ok')
        } else {
          setStatus('error')
        }
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <LavaLampProvider>
      <ClientPageShell heroReady={heroReady}>
        <ClientSection>
          <ClientGlassPanel label="CONFIRMAÇÃO DE E-MAIL">
            {status === 'checking' && (
              <p>Validando seu e-mail, aguarde...</p>
            )}

            {status === 'ok' && (
              <>
                <p>Seu e-mail foi confirmado com sucesso! Agora você já pode fazer login.</p>
                <p style={{ marginTop: 16 }}>
                  <Link href="/login">Ir para o login</Link>
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
