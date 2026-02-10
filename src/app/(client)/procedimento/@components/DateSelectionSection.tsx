import { forwardRef, useMemo, useState, type ReactNode } from 'react'
import type { RefObject } from 'react'

import { ClientGlassPanel } from '@/components/client/ClientPageLayout'

import { StepShell } from './StepShell'
import styles from '../procedimento.module.css'

type CalendarDay = {
  iso: string
  day: string
  isDisabled: boolean
  state: string
  isOutsideCurrentMonth: boolean
}

type SlotFilter = 'all' | 'morning' | 'afternoon'

type Props = {
  availabilityError: string | null
  isLoadingAvailability: boolean
  calendarHeaderDays: string[]
  calendarDays: { dayEntries: CalendarDay[] }
  monthTitle: string
  prevMonthLabel: string
  nextMonthLabel: string
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
  onOpenSummary: () => void
  actionMessage?: { kind: 'success' | 'error'; text: string } | null
  stepLabel?: string
  stepProgress?: ReactNode
}

function resolveSlotFilter(slotValue: string): SlotFilter {
  const hour = Number(slotValue.split(':')[0] ?? '')
  if (!Number.isFinite(hour)) return 'all'
  return hour < 12 ? 'morning' : 'afternoon'
}

export const DateSelectionSection = forwardRef<HTMLDivElement, Props>(function DateSelectionSection(
  {
    availabilityError,
    isLoadingAvailability,
    calendarHeaderDays,
    calendarDays,
    monthTitle,
    prevMonthLabel,
    nextMonthLabel,
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
    onOpenSummary,
    actionMessage,
    stepLabel,
    stepProgress,
  },
  ref,
) {
  const showTimeView = Boolean(selectedDate) && isPickingTime
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('all')

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return null
    return new Date(selectedDate).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
  }, [selectedDate])

  const summaryText = selectedDateLabel && selectedSlot
    ? `${selectedDateLabel} · ${selectedSlot}`
    : 'Selecione um dia e horário.'

  const filteredSlots = useMemo(() => {
    if (slotFilter === 'all') return slots
    return slots.filter((slotValue) => resolveSlotFilter(slotValue) === slotFilter)
  }, [slotFilter, slots])

  return (
    <section
      ref={ref}
      className={styles.section}
      id="sectionDia"
      data-step="dia"
      aria-label="Escolha do dia"
    >
      <StepShell
        title="Escolha o Dia e Horário"
        subtitle="Qual data você prefere?"
        stepLabel={stepLabel}
        stepProgress={stepProgress}
        ariaLabel="Escolha do dia"
        useGlass={false}
      >
        <div className={styles.stepCards}>
          <ClientGlassPanel className={styles.glass} aria-label="Calendário">
            <div className={styles.calendarPanel}>
              <div className={styles.calendarBody}>
                {availabilityError ? (
                  <div className={`${styles.status} ${styles.statusError}`}>{availabilityError}</div>
                ) : null}
                {!availabilityError && isLoadingAvailability ? (
                  <div className={`${styles.status} ${styles.statusInfo}`}>Carregando disponibilidade...</div>
                ) : null}

                <div className={styles.calendarHead}>
                  <div className={styles.calendarNavGroup}>
                    <button
                      type="button"
                      className={styles.calendarNav}
                      onClick={onPreviousMonth}
                      disabled={!selectedTechnique}
                      aria-label="Mês anterior"
                    >
                      {'\u2039'}
                    </button>
                    <span className={styles.calendarNavLabel}>{prevMonthLabel}</span>
                  </div>

                  <div className={styles.calendarTitle} id="cal-title">
                    {monthTitle}
                  </div>

                  <div className={`${styles.calendarNavGroup} ${styles.calendarNavGroupRight}`}>
                    <span className={styles.calendarNavLabel}>{nextMonthLabel}</span>
                    <button
                      type="button"
                      className={styles.calendarNav}
                      onClick={onNextMonth}
                      disabled={!selectedTechnique}
                      aria-label="Próximo mês"
                    >
                      {'\u203A'}
                    </button>
                  </div>
                </div>

                <div className={styles.calendarHeaderDivider} aria-hidden="true" />

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
            </div>
          </ClientGlassPanel>

          <ClientGlassPanel className={styles.glass} aria-label="Horários">
            <div className={styles.timePanel}>
              <div className={styles.slotFilters} aria-label="Filtro de período">
                <button
                  type="button"
                  className={styles.slotFilter}
                  data-active={slotFilter === 'all' ? 'true' : 'false'}
                  onClick={() => setSlotFilter('all')}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className={styles.slotFilter}
                  data-active={slotFilter === 'morning' ? 'true' : 'false'}
                  onClick={() => setSlotFilter('morning')}
                >
                  Manhã
                </button>
                <button
                  type="button"
                  className={styles.slotFilter}
                  data-active={slotFilter === 'afternoon' ? 'true' : 'false'}
                  onClick={() => setSlotFilter('afternoon')}
                >
                  Tarde
                </button>
              </div>

              <div ref={slotsContainerRef} className={styles.slotsScroll}>
                <div className={styles.slots}>
                  {showTimeView ? (
                    filteredSlots.length > 0 ? (
                      filteredSlots.map((slotValue) => {
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
                    )
                  ) : (
                    <div className={`${styles.status} ${styles.statusInfo}`}>Selecione um dia para ver horários.</div>
                  )}
                </div>
              </div>
            </div>
          </ClientGlassPanel>

          <ClientGlassPanel className={styles.glass} aria-label="Resumo">
            <div className={styles.summaryInline}>{summaryText}</div>
          </ClientGlassPanel>

          <div className={styles.summaryDock} aria-label="Ações">
            <div className={styles.summaryDockInner}>
              <button
                type="button"
                className={styles.summaryButtonPrimary}
                onClick={onOpenSummary}
                disabled={!selectedDate || !selectedSlot}
              >
                Resumo
              </button>
              <button
                type="button"
                className={styles.summaryButtonSecondary}
                onClick={onBackToCalendar}
              >
                Cancelar
              </button>
            </div>
          </div>
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
      </StepShell>
    </section>
  )
})
