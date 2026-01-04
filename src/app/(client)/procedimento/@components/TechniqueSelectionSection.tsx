import { ForwardedRef, forwardRef } from 'react'

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
  visibleTechniques: ServiceTechnique[]
  showAllTechniques: boolean
  onShowAllTechniques: () => void
}

export const TechniqueSelectionSection = forwardRef(function TechniqueSelectionSection(
  {
    catalogStatus,
    selectedProcedure,
    selectedTechniqueId,
    onTechniqueSelect,
    visibleTechniques,
    showAllTechniques,
    onShowAllTechniques,
  }: Props,
  ref: ForwardedRef<HTMLDivElement>,
) {
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
                <ProcedimentoGrid>
                  {visibleTechniques.map((technique) => (
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
              {!showAllTechniques && selectedProcedure.services.length > visibleTechniques.length && (
                <button type="button" className={styles.viewMore} onClick={onShowAllTechniques}>
                  Ver mais técnicas
                </button>
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
