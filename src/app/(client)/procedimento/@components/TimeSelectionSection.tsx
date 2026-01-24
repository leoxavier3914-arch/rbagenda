import { ForwardedRef, forwardRef, type ReactNode } from 'react'
import type { RefObject } from 'react'

import { ClientGlassPanel } from '@/components/client/ClientPageLayout'

import { ProcedimentoHeader } from './ProcedimentoHeader'
import styles from '../procedimento.module.css'

type Props = {
  sectionRef?: ForwardedRef<HTMLDivElement>
  slotsContainerRef: RefObject<HTMLDivElement | null>
  selectedDate: string | null
  slots: string[]
  bookedSlots: Set<string>
  selectedSlot: string | null
  actionMessage: { kind: 'success' | 'error'; text: string } | null
  onSlotSelect: (slot: string, disabled: boolean) => void
  stepLabel?: string
  stepProgress?: ReactNode
}

export const TimeSelectionSection = forwardRef(function TimeSelectionSection(
  {
    slotsContainerRef,
    selectedDate,
    slots,
    bookedSlots,
    selectedSlot,
    actionMessage,
    onSlotSelect,
    stepLabel,
    stepProgress,
  }: Props,
  ref: ForwardedRef<HTMLDivElement>,
) {
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
          subtitle="Selecione um horário disponível"
        />
        <ClientGlassPanel
          className={styles.glass}
          label="HORÁRIO"
          labelClassName={styles.label}
          aria-label="Escolha do horário"
        >
          <div ref={slotsContainerRef} className={styles.slots}>
            {!selectedDate ? (
              <div className={`${styles.status} ${styles.statusInfo}`}>
                Escolha um dia para ver os horários disponíveis.
              </div>
            ) : slots.length > 0 ? (
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
              <div className={`${styles.status} ${styles.statusInfo}`}>Sem horários para este dia.</div>
            )}
          </div>
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
