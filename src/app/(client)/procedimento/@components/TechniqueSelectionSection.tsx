import { ForwardedRef, forwardRef, useEffect, useMemo, useState, type ReactNode } from 'react'

import { ClientGlassPanel } from '@/components/client/ClientPageLayout'
import { LashIcon } from '@/components/client/LashIcon'

import { ProcedimentoCard } from './ProcedimentoCard'
import { ProcedimentoGrid } from './ProcedimentoGrid'
import { ProcedimentoHeader } from './ProcedimentoHeader'
import styles from '../procedimento.module.css'

import type { ServiceTechnique, TechniqueCatalogEntry } from '../types'

type Props = {
  sectionRef?: ForwardedRef<HTMLDivElement>
  catalogStatus: 'idle' | 'loading' | 'ready' | 'error'
  selectedProcedure: TechniqueCatalogEntry | null
  selectedTechniqueId: string | null
  onTechniqueSelect: (techniqueId: string) => void
  stepLabel?: string
  stepProgress?: ReactNode
}

export const TechniqueSelectionSection = forwardRef(function TechniqueSelectionSection(
  {
    catalogStatus,
    selectedProcedure,
    selectedTechniqueId,
    onTechniqueSelect,
    stepLabel,
    stepProgress,
  }: Props,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const pageSize = 4
  const techniques = useMemo<ServiceTechnique[]>(() => selectedProcedure?.services ?? [], [selectedProcedure])
  const [pageIndex, setPageIndex] = useState(0)
  const totalPages = useMemo(
    () => (techniques.length > 0 ? Math.ceil(techniques.length / pageSize) : 0),
    [pageSize, techniques.length],
  )

  useEffect(() => {
    setPageIndex(0)
  }, [selectedProcedure?.id])

  useEffect(() => {
    setPageIndex((previous) => Math.min(previous, Math.max(totalPages - 1, 0)))
  }, [totalPages])

  const selectedTechniqueIndex = useMemo(
    () => techniques.findIndex((technique) => technique.id === selectedTechniqueId),
    [selectedTechniqueId, techniques],
  )

  useEffect(() => {
    if (selectedTechniqueIndex < 0) return
    const targetPage = Math.floor(selectedTechniqueIndex / pageSize)
    setPageIndex((previous) => (previous === targetPage ? previous : targetPage))
  }, [pageSize, selectedTechniqueIndex])

  const techniquesPage = useMemo(() => {
    const start = pageIndex * pageSize
    return techniques.slice(start, start + pageSize)
  }, [pageIndex, pageSize, techniques])

  const showPagination =
    techniques.length > 0 &&
    totalPages > 1

  return (
    <section
      ref={ref}
      className={styles.section}
      id="sectionTecnica"
      data-step="tecnica"
      aria-label="Escolha da técnica"
    >
      <div className={styles.stack}>
        <ProcedimentoHeader
          className={styles.procedimentoHeader}
          eyebrow={stepLabel}
          progress={stepProgress}
          title={(
            <>
              <span>Escolha sua</span>
              <br />
              <span>técnica</span>
            </>
          )}
          subtitle="Qual técnica você deseja? Você poderá ajustar depois."
        />
        <ClientGlassPanel
          className={styles.glass}
          label="TÉCNICA"
          labelClassName={styles.label}
          aria-label="Técnicas de cílios"
        >
          {catalogStatus === 'ready' && selectedProcedure ? (
            <>
              {selectedProcedure.services.length > 0 ? (
                <ProcedimentoGrid
                  showControls={false}
                  pageIndex={pageIndex}
                  totalPages={totalPages}
                  onPreviousPage={() => setPageIndex((previous) => Math.max(0, previous - 1))}
                  onNextPage={() => setPageIndex((previous) => Math.min(totalPages - 1, previous + 1))}
                >
                  {techniquesPage.map((technique) => {
                    const isActive = selectedTechniqueId === technique.id
                    return (
                      <ProcedimentoCard
                        key={technique.id}
                        active={isActive}
                        onClick={() => onTechniqueSelect(technique.id)}
                      >
                        <span className={styles.cardIcon} aria-hidden="true">
                          <LashIcon />
                        </span>
                        <span className={styles.cardContent}>
                          <span className={styles.cardTitle}>{technique.name}</span>
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
              ) : (
                <div className={`${styles.status} ${styles.statusInfo}`}>
                  Nenhuma técnica disponível para este tipo.
                </div>
              )}
            </>
          ) : (
            <div className={`${styles.status} ${styles.statusInfo}`}>
              Selecione um tipo para ver as técnicas disponíveis.
            </div>
          )}
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
