import { type ReactNode } from 'react'

import styles from '../procedimento.module.css'

type ProcedimentoWrapperProps = {
  heroReady: boolean
  children: ReactNode
}

export function ProcedimentoWrapper({ heroReady, children }: ProcedimentoWrapperProps) {
  return (
    <main className={`${styles.wrapper} ${heroReady ? styles.heroReady : ''}`}>
      <div className={styles.page}>{children}</div>
    </main>
  )
}
