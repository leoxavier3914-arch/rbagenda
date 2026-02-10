import { ForwardedRef, forwardRef, useEffect, useMemo, useState, type ReactNode } from 'react'

import { PaginationDots } from './PaginationDots'
import { ProcedimentoCard } from './ProcedimentoCard'
import { ProcedimentoGrid } from './ProcedimentoGrid'
import { StepShell } from './StepShell'
import styles from '../procedimento.module.css'

import type { TechniqueCatalogEntry } from '../types'

type Props = {
  catalogError: string | null
  catalogStatus: 'idle' | 'loading' | 'ready' | 'error'
  availableProcedures: TechniqueCatalogEntry[]
  selectedProcedureId: string | null
  onSelect: (procedureId: string) => void
  stepLabel?: string
  stepProgress?: ReactNode
}

export const TypeSelectionSection = forwardRef(function TypeSelectionSection(
  {
    catalogError,
    catalogStatus,
    availableProcedures,
    selectedProcedureId,
    onSelect,
    stepLabel,
    stepProgress,
  }: Props,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const pageSize = 4
  const procedures = useMemo(
    () => (catalogStatus === 'ready' ? availableProcedures : []),
    [availableProcedures, catalogStatus],
  )
  const [pageIndex, setPageIndex] = useState(0)
  const totalPages = useMemo(
    () => (procedures.length > 0 ? Math.ceil(procedures.length / pageSize) : 0),
    [procedures.length, pageSize],
  )

  useEffect(() => {
    setPageIndex((previous) => Math.min(previous, Math.max(totalPages - 1, 0)))
  }, [totalPages])

  const selectedProcedureIndex = useMemo(
    () => procedures.findIndex((procedure) => procedure.id === selectedProcedureId),
    [procedures, selectedProcedureId],
  )

  useEffect(() => {
    if (selectedProcedureIndex < 0) return
    const targetPage = Math.floor(selectedProcedureIndex / pageSize)
    setPageIndex((previous) => (previous === targetPage ? previous : targetPage))
  }, [pageSize, selectedProcedureIndex])

  const proceduresPage = useMemo(() => {
    const start = pageIndex * pageSize
    return procedures.slice(start, start + pageSize)
  }, [pageIndex, pageSize, procedures])

  return (
    <section ref={ref} className={styles.section} id="sectionTipo" data-step="tipo" aria-label="Escolha do tipo">
      <StepShell
        title="Agende seu Serviço"
        subtitle="Escolha o tipo de serviço:"
        stepLabel={stepLabel}
        stepProgress={stepProgress}
        ariaLabel="Escolha do tipo"
        useGlass={false}
        footer={(
          <PaginationDots
            pageIndex={pageIndex}
            totalPages={totalPages}
            ariaLabel="Paginação do grid"
            onPrevious={() => setPageIndex((previous) => Math.max(0, previous - 1))}
            onNext={() => setPageIndex((previous) => Math.min(Math.max(totalPages - 1, 0), previous + 1))}
            onSelect={(index) => setPageIndex(() => Math.min(Math.max(index, 0), Math.max(totalPages - 1, 0)))}
          />
        )}
      >
        {catalogError && <div className={`${styles.status} ${styles.statusError}`}>{catalogError}</div>}
        {!catalogError && catalogStatus === 'loading' && (
          <div className={`${styles.status} ${styles.statusInfo}`}>Carregando procedimentos...</div>
        )}
        {catalogStatus === 'ready' && availableProcedures.length === 0 && (
          <div className={`${styles.status} ${styles.statusInfo}`}>Nenhum tipo disponível no momento.</div>
        )}
        {catalogStatus === 'ready' && procedures.length > 0 ? (
          <ProcedimentoGrid
            showControls={false}
            pageIndex={pageIndex}
            totalPages={totalPages}
            onPreviousPage={() => setPageIndex((previous) => Math.max(0, previous - 1))}
            onNextPage={() => setPageIndex((previous) => Math.min(totalPages - 1, previous + 1))}
          >
            {proceduresPage.map((procedure) => {
              const isActive = selectedProcedureId === procedure.id
              const subtitle = procedure.description ?? ''
              return (
                <ProcedimentoCard
                  key={procedure.id}
                  active={isActive}
                  onClick={() => onSelect(procedure.id)}
                >
                  <div className={styles.cardV2}>
                    <div className={styles.cardV2Header}>
                      <span className={styles.cardV2Title}>{procedure.name}</span>
                      <span className={styles.cardV2Check} data-visible={isActive ? 'true' : 'false'} aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                          <path
                            d="M20 6L9 17l-5-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </div>
                    <div className={styles.cardV2Art} aria-hidden="true">
                      <div className={styles.cardV2ArtInner}>
                        <img src="/photos/olhopadrao.png" alt="" />
                      </div>
                    </div>
                    <div className={styles.cardV2Band} data-empty={subtitle ? 'false' : 'true'}>
                      <span className={styles.cardV2BandText}>{subtitle}</span>
                    </div>
                  </div>
                </ProcedimentoCard>
              )
            })}
          </ProcedimentoGrid>
        ) : null}
      </StepShell>
    </section>
  )
})







