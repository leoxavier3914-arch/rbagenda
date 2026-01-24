import { ForwardedRef, forwardRef, useEffect, useMemo, useState, type ReactNode } from 'react'

import { ClientGlassPanel } from '@/components/client/ClientPageLayout'
import { LashIcon } from '@/components/client/LashIcon'

import { ProcedimentoCard } from './ProcedimentoCard'
import { ProcedimentoGrid } from './ProcedimentoGrid'
import { ProcedimentoHeader } from './ProcedimentoHeader'
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
  { catalogError, catalogStatus, availableProcedures, selectedProcedureId, onSelect, stepLabel, stepProgress }: Props,
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

  const showPagination = procedures.length > 0 && totalPages > 1

  return (
    <section ref={ref} className={styles.section} id="sectionTipo" data-step="tipo" aria-label="Escolha do tipo">
      <div className={styles.stack}>
        <ProcedimentoHeader
          className={styles.procedimentoHeader}
          eyebrow={stepLabel}
          progress={stepProgress}
          title="Escolha seu procedimento"
          subtitle="Selecione o tipo de atendimento"
        />
        <ClientGlassPanel
          className={styles.glass}
          label="TIPO"
          labelClassName={styles.label}
          aria-label="Tipos de procedimento"
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
                return (
                  <ProcedimentoCard
                    key={procedure.id}
                    active={isActive}
                    onClick={() => onSelect(procedure.id)}
                  >
                    <span className={styles.cardIcon} aria-hidden="true">
                      <LashIcon />
                    </span>
                    <span className={styles.cardContent}>
                      <span className={styles.cardTitle}>{procedure.name}</span>
                    </span>
                    <span className={styles.cardIndicator} aria-hidden="true">
                      {isActive ? (
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
                      ) : (
                        <svg viewBox="0 0 24 24" role="presentation">
                          <path
                            d="M9 6l6 6-6 6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                  </ProcedimentoCard>
                )
              })}
            </ProcedimentoGrid>
          ) : null}
        </ClientGlassPanel>
        <div
          className={[
            styles.gridControls,
            showPagination ? '' : styles.gridControlsPlaceholder,
          ].filter(Boolean).join(' ')}
          aria-label="Paginação do grid"
          aria-hidden={showPagination ? undefined : true}
        >
          {showPagination ? (
            <>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => setPageIndex((previous) => Math.max(0, previous - 1))}
                disabled={pageIndex === 0}
                aria-label="Página anterior"
              >
                ‹
              </button>
              <span className={styles.pageIndicator}>{pageIndex + 1} / {totalPages}</span>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => setPageIndex((previous) => Math.min(totalPages - 1, previous + 1))}
                disabled={pageIndex + 1 >= totalPages}
                aria-label="Próxima página"
              >
                ›
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
})
