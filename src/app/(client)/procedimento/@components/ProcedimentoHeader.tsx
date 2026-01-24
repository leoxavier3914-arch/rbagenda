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
      <div className={styles.headerCopy}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.headerSubtitle}>{subtitle}</p> : null}
      </div>
    </header>
  )
}
