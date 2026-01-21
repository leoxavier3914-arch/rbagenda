import { type ReactNode } from 'react'

import styles from '../procedimento.module.css'

type ProcedimentoHeaderProps = {
  title: ReactNode
  subtitle?: ReactNode
  className?: string
}

export function ProcedimentoHeader({ title, subtitle, className }: ProcedimentoHeaderProps) {
  const headerClassName = [styles.header, className].filter(Boolean).join(' ')
  return (
    <header className={headerClassName}>
      <svg aria-hidden="true" className={styles.diamond} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3l4 4-4 4-4-4 4-4Z" />
        <path d="M12 13l4 4-4 4-4-4 4-4Z" />
      </svg>
      <div className={styles.headerCopy}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.headerSubtitle}>{subtitle}</p> : null}
      </div>
    </header>
  )
}
