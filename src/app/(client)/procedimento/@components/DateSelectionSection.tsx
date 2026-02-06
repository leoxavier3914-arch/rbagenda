import { ForwardedRef, forwardRef, type ReactNode } from 'react'
import type { RefObject } from 'react'

import { StepShell } from './StepShell'
import styles from '../procedimento.module.css'

type CalendarDay = {
  iso: string
  day: string
  isDisabled: boolean
  state: string
  isOutsideCurrentMonth: boolean
}

type Props = {
  sectionRef?: ForwardedRef<HTMLDivElement>
  availabilityError: string | null
  isLoadingAvailability: boolean
  calendarHeaderDays: string[]
  calendarDays: { dayEntries: CalendarDay[] }
  monthTitle: string
  selectedTechnique: unknown
  selectedDate: string | null
  onPreviousMonth: () => void
  onNextMonth: () => void
  onDaySelect: (iso: string, disabled: boolean) => void
  isPickingTime: boolean
  slotsContainerRef?: RefObject<HTMLDivElement | null>
  slots: string[]
  bookedSlots: Set<string>
  selectedSlot: string | null
  onSlotSelect: (slot: string, disabled: boolean) => void
  onBackToCalendar: () => void
  actionMessage?: { kind: 'success' | 'error'; text: string } | null
  stepLabel?: string
  stepProgress?: ReactNode
}

export const DateSelectionSection = forwardRef(function DateSelectionSection(
  {
    availabilityError,
    isLoadingAvailability,
    calendarHeaderDays,
    calendarDays,
    monthTitle,
    selectedTechnique,
    selectedDate,
    onPreviousMonth,
    onNextMonth,
    onDaySelect,
    isPickingTime,
    slotsContainerRef,
    slots,
    bookedSlots,
    selectedSlot,
    onSlotSelect,
    onBackToCalendar,
    actionMessage,
    stepLabel,
    stepProgress,
  }: Props,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const showTimeView = Boolean(isPickingTime && selectedDate)
  const selectedDateLabel = selectedDate
    ? new Date(selectedDate).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null

  return (
    <section
      ref={ref}
      className={styles.section}
      id="sectionDia"
      data-step="dia"
      aria-label="Escolha do dia"
    >
      <StepShell
        title={
          <>
            <span>Escolha o</span>
            <br />
            <span>dia e horário</span>
          </>
        }
        subtitle={showTimeView ? 'Selecione um horário disponível' : 'Selecione uma data disponível'}
        stepLabel={stepLabel}
        stepProgress={stepProgress}
        ariaLabel="Escolha do dia"
      >
        {showTimeView ? (
          <div className={styles.calendarPanel}>
            <div className={styles.periodHeader}>
              <button
                type="button"
                className={styles.periodBackButton}
                onClick={onBackToCalendar}
              >
                Voltar
              </button>
              {selectedDateLabel ? <span className={styles.periodLabel}>Dia: {selectedDateLabel}</span> : null}
            </div>
            <div ref={slotsContainerRef} className={styles.slotsScroll}>
              <div className={styles.slots}>
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
                  <div className={`${styles.status} ${styles.statusInfo}`}>Sem horários para este dia.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.calendarPanel}>
            {availabilityError && <div className={`${styles.status} ${styles.statusError}`}>{availabilityError}</div>}
            {!availabilityError && isLoadingAvailability && (
              <div className={`${styles.status} ${styles.statusInfo}`}>Carregando disponibilidade…</div>
            )}
            <div className={styles.calendarHead}>
              <button
                type="button"
                className={styles.calendarNav}
                onClick={onPreviousMonth}
                disabled={!selectedTechnique}
                aria-label="Mês anterior"
              >
                ‹
              </button>
              <div className={styles.calendarTitle} id="cal-title">
                {monthTitle}
              </div>
              <button
                type="button"
                className={styles.calendarNav}
                onClick={onNextMonth}
                disabled={!selectedTechnique}
                aria-label="Próximo mês"
              >
                ›
              </button>
            </div>
            <div className={styles.calendarGrid} aria-hidden="true">
              {calendarHeaderDays.map((label, index) => (
                <div key={`dow-${index}`} className={`${styles.calendarDay} ${styles.calendarDayHeader}`}>
                  {label}
                </div>
              ))}
            </div>
            <div className={`${styles.calendarGrid} ${styles.calendarGridDays}`} role="grid">
              {calendarDays.dayEntries.map(({ iso, day, isDisabled, state, isOutsideCurrentMonth }) => (
                <button
                  key={iso}
                  type="button"
                  className={styles.calendarDay}
                  data-state={state}
                  data-selected={!isOutsideCurrentMonth && selectedDate === iso}
                  data-outside-month={isOutsideCurrentMonth ? 'true' : 'false'}
                  aria-disabled={isDisabled}
                  disabled={isDisabled}
                  onClick={() => onDaySelect(iso, isDisabled)}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
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
      </StepShell>
    </section>
  )
})
