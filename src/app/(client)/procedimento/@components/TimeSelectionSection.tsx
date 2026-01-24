import { ForwardedRef, forwardRef, type ReactNode } from 'react'
import type { RefObject } from 'react'

import { ClientGlassPanel } from '@/components/client/ClientPageLayout'
import { LashIcon } from '@/components/client/LashIcon'

import { ProcedimentoCard } from './ProcedimentoCard'
import { ProcedimentoHeader } from './ProcedimentoHeader'
import { ProcedimentoGrid } from './ProcedimentoGrid'
import styles from '../procedimento.module.css'

import type { TimePeriod } from '../types'

type Props = {
  sectionRef?: ForwardedRef<HTMLDivElement>
  slotsContainerRef: RefObject<HTMLDivElement | null>
  selectedDate: string | null
  slots: string[]
  bookedSlots: Set<string>
  selectedSlot: string | null
  selectedPeriod: TimePeriod | null
  actionMessage: { kind: 'success' | 'error'; text: string } | null
  onSlotSelect: (slot: string, disabled: boolean) => void
  onPeriodSelect: (period: TimePeriod) => void
  onBackToPeriods: () => void
  stepLabel?: string
  stepProgress?: ReactNode
}

const periodOptions: Array<{ id: TimePeriod; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'morning', label: 'Manhã' },
  { id: 'afternoon', label: 'Tarde' },
  { id: 'night', label: 'Noite' },
]

const periodLabelMap = periodOptions.reduce((acc, option) => {
  acc[option.id] = option.label
  return acc
}, {} as Record<TimePeriod, string>)

export const TimeSelectionSection = forwardRef(function TimeSelectionSection(
  {
    slotsContainerRef,
    selectedDate,
    slots,
    bookedSlots,
    selectedSlot,
    selectedPeriod,
    actionMessage,
    onSlotSelect,
    onPeriodSelect,
    onBackToPeriods,
    stepLabel,
    stepProgress,
  }: Props,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const selectedPeriodLabel = selectedPeriod ? periodLabelMap[selectedPeriod] : null

  return (
    <section
      ref={ref}
      className={styles.section}
      id="sectionHorario"
      data-step="horario"
      aria-label="Escolha do horário"
    >
      <div className={styles.stack}>
        <ProcedimentoHeader
          className={styles.procedimentoHeader}
          eyebrow={stepLabel}
          progress={stepProgress}
          title="Escolha o horário"
          subtitle={selectedPeriod ? 'Selecione um horário disponível' : 'Selecione o período do dia'}
        />
        <ClientGlassPanel
          className={[styles.glass, styles.stepPanelTall].join(' ')}
          label="HORÁRIO"
          labelClassName={styles.label}
          aria-label="Escolha do horário"
        >
          {!selectedDate ? (
            <div className={`${styles.status} ${styles.statusInfo}`}>
              Escolha um dia para ver os horários disponíveis.
            </div>
          ) : !selectedPeriod ? (
            <ProcedimentoGrid showControls={false}>
              {periodOptions.map((period) => (
                <ProcedimentoCard
                  key={period.id}
                  active={selectedPeriod === period.id}
                  onClick={() => onPeriodSelect(period.id)}
                >
                  <span className={styles.cardIcon} aria-hidden="true">
                    <LashIcon />
                  </span>
                  <span className={styles.cardContent}>
                    <span className={styles.cardTitle}>{period.label}</span>
                  </span>
                  <span className={styles.cardIndicator} aria-hidden="true">
                    {selectedPeriod === period.id ? (
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
              ))}
            </ProcedimentoGrid>
          ) : (
            <>
              <div className={styles.periodHeader}>
                <button
                  type="button"
                  className={styles.periodBackButton}
                  onClick={onBackToPeriods}
                >
                  Voltar
                </button>
                <span className={styles.periodLabel}>Período: {selectedPeriodLabel}</span>
              </div>
              <div ref={slotsContainerRef} className={styles.slots}>
                {slots.length > 0 ? (
                  slots.map((slotValue) => {
                    const disabled = bookedSlots.has(slotValue)
                    return (
                      <button
                        key={slotValue}
                        type="button"
                        className={styles.slot}
                        data-selected={selectedSlot === slotValue ? 'true' : 'false'}
                        data-busy={disabled ? 'true' : 'false'}
                        onClick={() => onSlotSelect(slotValue, disabled)}
                        disabled={disabled}
                      >
                        {slotValue}
                      </button>
                    )
                  })
                ) : (
                  <div className={`${styles.status} ${styles.statusInfo}`}>Sem horários para este período.</div>
                )}
              </div>
            </>
          )}
          {actionMessage ? (
            <div
              className={`${styles.status} ${
                actionMessage.kind === 'success' ? styles.statusSuccess : styles.statusError
              }`}
            >
              {actionMessage.text}
            </div>
          ) : null}
        </ClientGlassPanel>
      </div>
    </section>
  )
})
