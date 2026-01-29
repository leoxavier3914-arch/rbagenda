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
  panelLabel: string
  panelLabelClassName?: string
  footer?: ReactNode
  children: ReactNode
}

export function StepShell({
  title,
  subtitle,
  stepLabel,
  stepProgress,
  ariaLabel,
  panelLabel,
  panelLabelClassName,
  footer,
  children,
}: StepShellProps) {
  return (
    <div className={styles.stack} aria-label={ariaLabel}>
      <ProcedimentoHeader
        className={styles.procedimentoHeader}
        eyebrow={stepLabel}
        progress={stepProgress}
        title={title}
        subtitle={subtitle}
      />
      <ClientGlassPanel
        className={styles.glass}
        label={panelLabel}
        labelClassName={panelLabelClassName}
        aria-label={ariaLabel}
      >
        {children}
      </ClientGlassPanel>
      <div className={styles.stepFooter} aria-hidden={footer ? undefined : true}>
        {footer}
      </div>
    </div>
  )
}
