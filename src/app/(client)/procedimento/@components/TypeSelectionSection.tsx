import { ForwardedRef, forwardRef } from 'react'

import { ClientGlassPanel } from '@/components/client/ClientPageLayout'
import { LashIcon } from '@/components/client/LashIcon'

import { ProcedimentoCard } from './ProcedimentoCard'
import { ProcedimentoGrid } from './ProcedimentoGrid'
import { ProcedimentoHeader } from './ProcedimentoHeader'
import styles from '../procedimento.module.css'

import type { ServiceOption } from '../types'

type Props = {
  catalogError: string | null
  catalogStatus: 'idle' | 'loading' | 'ready' | 'error'
  availableServices: ServiceOption[]
  selectedServiceId: string | null
  onSelect: (serviceId: string) => void
  defaultLabels: readonly string[]
}

export const TypeSelectionSection = forwardRef(function TypeSelectionSection(
  { catalogError, catalogStatus, availableServices, selectedServiceId, onSelect, defaultLabels }: Props,
    ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <section ref={ref} className={styles.section} id="sectionTipo" data-step="tipo" aria-label="Escolha do tipo">
      <div className={styles.stack}>
        <ProcedimentoHeader>
          <>Escolha <span className={styles.subtitle}>seu</span> Procedimento:</>
        </ProcedimentoHeader>
        <ClientGlassPanel
          className={styles.glass}
          label="TIPO"
          labelClassName={styles.label}
          aria-label="Tipos de procedimento"
        >
          {catalogError && <div className={`${styles.status} ${styles.statusError}`}>{catalogError}</div>}
          {catalogStatus === 'ready' && availableServices.length === 0 && (
            <div className={`${styles.status} ${styles.statusInfo}`}>Nenhum tipo disponível no momento.</div>
          )}
          <ProcedimentoGrid variant="tipo">
            {catalogStatus === 'ready' && availableServices.length > 0 ? (
              availableServices.map((service) => (
                <ProcedimentoCard
                  key={service.id}
                  active={selectedServiceId === service.id}
                  onClick={() => onSelect(service.id)}
                >
                  <LashIcon />
                  <span>{service.name}</span>
                </ProcedimentoCard>
              ))
            ) : (
              defaultLabels.map((label) => (
                <ProcedimentoCard key={label} as="div">
                  <LashIcon />
                  <span>{label}</span>
                </ProcedimentoCard>
              ))
            )}
          </ProcedimentoGrid>
        </ClientGlassPanel>
        <footer className={styles.footer}>ROMEIKE BEAUTY</footer>
      </div>
    </section>
  )
})
