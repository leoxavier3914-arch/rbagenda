import { type ReactNode } from 'react'

import { ClientGlassPanel } from '@/components/client/ClientPageLayout'

import { ProcedimentoHeader } from './ProcedimentoHeader'
import styles from '../procedimento.module.css'

type StepShellProps = {
  title: ReactNode
  subtitle?: ReactNode
  stepLabel?: ReactNode
  stepProgress?: ReactNode
  ariaLabel: string
  footer?: ReactNode
  children: ReactNode
}

export function StepShell({
  title,
  subtitle,
  stepLabel,
  stepProgress,
  ariaLabel,
  footer,
  children,
}: StepShellProps) {
  return (
    <div className={`${styles.stack} ${styles.stepShell}`} aria-label={ariaLabel}>
      <ProcedimentoHeader
        className={styles.procedimentoHeader}
        eyebrow={stepLabel}
        progress={stepProgress}
        title={title}
        subtitle={subtitle}
      />
      <ClientGlassPanel
        className={styles.glass}
        aria-label={ariaLabel}
      >
        {children}
      </ClientGlassPanel>
      <div
        className={styles.stepFooter}
        data-empty={footer ? 'false' : 'true'}
        aria-hidden={footer ? undefined : true}
      >
        {footer}
      </div>
    </div>
  )
}
