import { ForwardedRef, forwardRef, type ReactNode } from 'react'

import { ClientGlassPanel } from '@/components/client/ClientPageLayout'

import { ProcedimentoHeader } from './ProcedimentoHeader'
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
    stepLabel,
    stepProgress,
  }: Props,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <section
      ref={ref}
      className={styles.section}
      id="sectionDia"
      data-step="dia"
      aria-label="Escolha do dia"
    >
      <div className={styles.stack}>
        <ProcedimentoHeader
          className={styles.procedimentoHeader}
          eyebrow={stepLabel}
          progress={stepProgress}
          title="Escolha o dia"
          subtitle="Selecione uma data disponível"
        />
        <ClientGlassPanel
          className={styles.glass}
          label="DIA"
          labelClassName={styles.label}
          aria-label="Escolha do dia"
        >
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
          <div className={styles.calendarGrid} role="grid">
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
        </ClientGlassPanel>
      </div>
    </section>
  )
})
