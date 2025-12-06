import { type ReactNode } from 'react'

import styles from '../procedimento.module.css'

type ProcedimentoCardProps = {
  children: ReactNode
  active?: boolean
  as?: 'button' | 'div'
  onClick?: () => void
}

export function ProcedimentoCard({ children, active, as = 'button', onClick }: ProcedimentoCardProps) {
  const Component = as === 'button' ? 'button' : 'div'

  return (
    <Component
      type={as === 'button' ? 'button' : undefined}
      className={styles.card}
      data-active={active ? 'true' : 'false'}
      onClick={onClick}
    >
      <div className={styles.cardInner}>{children}</div>
    </Component>
  )
}
