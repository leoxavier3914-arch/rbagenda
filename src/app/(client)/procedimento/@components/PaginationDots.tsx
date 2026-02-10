import styles from '../procedimento.module.css'

type Props = {
  pageIndex: number
  totalPages: number
  onPrevious: () => void
  onNext: () => void
  onSelect: (index: number) => void
  ariaLabel?: string
}

export function PaginationDots({
  pageIndex,
  totalPages,
  onPrevious,
  onNext,
  onSelect,
  ariaLabel = 'Paginação',
}: Props) {
  const pages = Array.from({ length: Math.max(0, totalPages) })
  const isSinglePage = totalPages <= 1

  return (
    <div className={styles.paginationDock} data-hidden={isSinglePage ? 'true' : 'false'}>
      <div className={styles.gridControls} aria-label={ariaLabel}>
        <button
          type="button"
          className={styles.navButton}
          onClick={onPrevious}
          disabled={isSinglePage || pageIndex === 0}
          aria-label="Página anterior"
        >
          {'\u2039'}
        </button>

        <div className={styles.paginationDots} role="tablist" aria-label={ariaLabel}>
          {pages.map((_, index) => (
            <button
              key={`dot-${index}`}
              type="button"
              className={styles.paginationDot}
              data-active={index === pageIndex ? 'true' : 'false'}
              aria-label={`Página ${index + 1}`}
              aria-current={index === pageIndex ? 'page' : undefined}
              disabled={isSinglePage}
              onClick={() => onSelect(index)}
            />
          ))}
        </div>

        <button
          type="button"
          className={styles.navButton}
          onClick={onNext}
          disabled={isSinglePage || pageIndex + 1 >= totalPages}
          aria-label="Próxima página"
        >
          {'\u203A'}
        </button>
      </div>
    </div>
  )
}

