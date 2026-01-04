import { ForwardedRef, forwardRef, useEffect, useMemo, useState } from 'react'

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
}

export const TechniqueSelectionSection = forwardRef(function TechniqueSelectionSection(
  {
    catalogStatus,
    selectedProcedure,
    selectedTechniqueId,
    onTechniqueSelect,
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
      <div className={styles.stack}>
        <ProcedimentoHeader className={styles.procedimentoHeader}>
          <>Escolha <span className={styles.subtitle}>sua</span> Técnica:</>
        </ProcedimentoHeader>
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
                  pageIndex={pageIndex}
                  totalPages={totalPages}
                  onPreviousPage={() => setPageIndex((previous) => Math.max(0, previous - 1))}
                  onNextPage={() => setPageIndex((previous) => Math.min(totalPages - 1, previous + 1))}
                >
                  {techniquesPage.map((technique) => (
                    <ProcedimentoCard
                      key={technique.id}
                      active={selectedTechniqueId === technique.id}
                      onClick={() => onTechniqueSelect(technique.id)}
                    >
                      <LashIcon />
                      <span>{technique.name}</span>
                    </ProcedimentoCard>
                  ))}
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
      </div>
    </section>
  )
})
