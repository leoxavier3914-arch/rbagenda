import { ForwardedRef, forwardRef, useEffect, useMemo, useState, type ReactNode } from 'react'

import { PaginationDots } from './PaginationDots'
import { ProcedimentoCard } from './ProcedimentoCard'
import { ProcedimentoGrid } from './ProcedimentoGrid'
import { StepShell } from './StepShell'
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

  return (
    <section
      ref={ref}
      className={styles.section}
      id="sectionTecnica"
      data-step="tecnica"
      aria-label="Escolha da técnica"
    >
      <StepShell
        title="Escolha sua Técnica"
        subtitle="Escolha o estilo dos seus cílios:"
        stepLabel={stepLabel}
        stepProgress={stepProgress}
        ariaLabel="Escolha da técnica"
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
                  const subtitle = technique.slug
                    ? String(technique.slug).replace(/-/g, ' ')
                    : `${Math.max(0, Math.round(technique.duration_min))} min`
                  return (
                    <ProcedimentoCard
                      key={technique.id}
                      active={isActive}
                      onClick={() => onTechniqueSelect(technique.id)}
                    >
                      <div className={styles.cardV2}>
                        <div className={styles.cardV2Header}>
                          <span className={styles.cardV2Title}>{technique.name}</span>
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
      </StepShell>
    </section>
  )
})







