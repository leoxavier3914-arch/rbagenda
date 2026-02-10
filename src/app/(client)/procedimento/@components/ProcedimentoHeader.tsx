import { type ReactNode } from 'react'

import styles from '../procedimento.module.css'

type ProcedimentoHeaderProps = {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  progress?: ReactNode
  className?: string
}

export function ProcedimentoHeader({ title, subtitle, eyebrow, progress, className }: ProcedimentoHeaderProps) {
  const headerClassName = [styles.header, className].filter(Boolean).join(' ')
  return (
    <header className={headerClassName}>
      {eyebrow || progress ? (
        <div className={styles.wizardHeader}>
          {eyebrow ? <span className={styles.stepIndicator}>{eyebrow}</span> : null}
          {progress}
          <div className={styles.wizardHeaderDivider} aria-hidden="true" />
        </div>
      ) : null}
      <div className={styles.headerCopy}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.headerSubtitle}>{subtitle}</p> : null}
      </div>
    </header>
  )
}
