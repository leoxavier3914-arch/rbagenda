import { type ReactNode } from 'react'

import styles from '../procedimento.module.css'

type ProcedimentoGridProps = {
  children: ReactNode
  variant?: 'tipo' | 'tecnica'
}

export function ProcedimentoGrid({ children, variant }: ProcedimentoGridProps) {
  const className = [styles.grid, variant === 'tipo' ? styles.tipoGrid : undefined]
    .filter(Boolean)
    .join(' ')

  return <div className={className}>{children}</div>
}
