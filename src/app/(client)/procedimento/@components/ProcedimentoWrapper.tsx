import { type ReactNode } from 'react'

import { ClientPageShell } from '@/components/client/ClientPageLayout'

import styles from '../procedimento.module.css'

type ProcedimentoWrapperProps = {
  heroReady: boolean
  children: ReactNode
}

export function ProcedimentoWrapper({ heroReady, children }: ProcedimentoWrapperProps) {
  const wrapperClassName = `${styles.wrapper} ${heroReady ? styles.heroReady : ''}`

  return (
    <ClientPageShell
      heroReady={heroReady}
      className={wrapperClassName}
      forceMotion
      respectNoMotionHash
    >
      <div className={styles.pageSection}>{children}</div>
    </ClientPageShell>
  )
}
