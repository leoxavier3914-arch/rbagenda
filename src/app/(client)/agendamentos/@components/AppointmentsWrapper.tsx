import { type ReactNode } from 'react'

import { ClientPageShell, ClientSection } from '@/components/client/ClientPageLayout'

import styles from '../agendamentos.module.css'

type AppointmentsWrapperProps = {
  heroReady: boolean
  children: ReactNode
}

export function AppointmentsWrapper({ heroReady, children }: AppointmentsWrapperProps) {
  return (
    <ClientPageShell heroReady={heroReady} className={styles.wrapper}>
      <ClientSection className={styles.pageSection}>
        <div className={styles.page}>{children}</div>
      </ClientSection>
    </ClientPageShell>
  )
}
