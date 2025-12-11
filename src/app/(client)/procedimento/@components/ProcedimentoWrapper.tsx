import { type ReactNode } from 'react'

import { ClientPageShell, ClientSection } from '@/components/client/ClientPageLayout'

type ProcedimentoWrapperProps = {
  heroReady: boolean
  children: ReactNode
}

export function ProcedimentoWrapper({ heroReady, children }: ProcedimentoWrapperProps) {
  return (
    <ClientPageShell heroReady={heroReady}>
      <ClientSection>{children}</ClientSection>
    </ClientPageShell>
  )
}
