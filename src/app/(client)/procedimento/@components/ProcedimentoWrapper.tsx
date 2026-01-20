import { type ReactNode } from 'react'

import { ClientPageShell, ClientSection } from '@/components/client/ClientPageLayout'

import styles from '../procedimento.module.css'

type ProcedimentoWrapperProps = {
  heroReady: boolean
  children: ReactNode
}

export function ProcedimentoWrapper({ heroReady, children }: ProcedimentoWrapperProps) {
  const wrapperClassName = [
    styles.wrapper,
    styles.shellPadding,
    heroReady ? styles.heroReady : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <ClientPageShell
      heroReady={heroReady}
      className={wrapperClassName}
      forceMotion
      respectNoMotionHash
    >
      <ClientSection className={styles.pageSection}>
        <div className={styles.page}>{children}</div>
      </ClientSection>
    </ClientPageShell>
  )
}
