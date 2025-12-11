import { type ReactNode } from 'react'

import { ClientPageShell, ClientSection } from '@/components/client/ClientPageLayout'

import styles from '../procedimento.module.css'

type ProcedimentoWrapperProps = {
  heroReady: boolean
  children: ReactNode
}

export function ProcedimentoWrapper({ heroReady, children }: ProcedimentoWrapperProps) {
  return (
    <ClientPageShell heroReady={heroReady}>
      <ClientSection className={styles.contentSection}>
        <div className={styles.pageContent}>{children}</div>
      </ClientSection>
    </ClientPageShell>
  )
}
