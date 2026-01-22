import { type ReactNode } from 'react'

import styles from '../procedimento.module.css'

type ProcedimentoGridProps = {
  children: ReactNode
  pageIndex?: number
  totalPages?: number
  onPreviousPage?: () => void
  onNextPage?: () => void
  showControls?: boolean
}

export function ProcedimentoGrid({
  children,
  pageIndex,
  totalPages,
  onNextPage,
  onPreviousPage,
  showControls = true,
}: ProcedimentoGridProps) {
  const className = styles.grid

  const showPagination =
    showControls &&
    typeof pageIndex === 'number' &&
    typeof totalPages === 'number' &&
    totalPages > 1 &&
    typeof onPreviousPage === 'function' &&
    typeof onNextPage === 'function'

  return (
    <div className={styles.gridWrapper}>
      {showPagination && (
        <div className={styles.gridControls} aria-label="Paginação do grid">
          <button
            type="button"
            className={styles.navButton}
            onClick={onPreviousPage}
            disabled={pageIndex === 0}
            aria-label="Página anterior"
          >
            ‹
          </button>
          <span className={styles.pageIndicator}>{pageIndex + 1} / {totalPages}</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={onNextPage}
            disabled={pageIndex + 1 >= totalPages}
            aria-label="Próxima página"
          >
            ›
          </button>
        </div>
      )}
      <div className={className}>{children}</div>
    </div>
  )
}
