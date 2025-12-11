import { type ReactNode } from 'react'

import { ClientPageShell, ClientSection } from '@/components/client/ClientPageLayout'

import styles from '../procedimento.module.css'

type ProcedimentoWrapperProps = {
  heroReady: boolean
  children: ReactNode
}

export function ProcedimentoWrapper({ heroReady, children }: ProcedimentoWrapperProps) {
  const wrapperClassName = `${styles.wrapper} ${heroReady ? styles.heroReady : ''}`

  return (
    <ClientPageShell heroReady={heroReady} className={wrapperClassName}>
      <ClientSection className={styles.pageSection}>
        <div className={styles.page}>{children}</div>
      </ClientSection>
    </ClientPageShell>
  )
}
