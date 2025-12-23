'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClientModal } from '@/components/client/ClientModal'
import modalStyles from '@/components/client/client-modal.module.css'
import { useClientAvailability } from '@/hooks/useClientAvailability'
import { DEFAULT_FALLBACK_BUFFER_MINUTES, DEFAULT_TIMEZONE } from '@/lib/availability'

import styles from '../agendamentos.module.css'
import type { CalendarDayEntry, NormalizedAppointment, SlotOption } from '../types'

type RescheduleModalProps = {
  appointment: NormalizedAppointment
  onClose: () => void
  onSuccess: (payload: { starts_at: string; ends_at: string | null }) => void
  ensureAuth: () => Promise<string | null>
  formatTime: (iso: string) => string
  hoursUntil: (iso: string) => number
  toIsoDate: (date: Date) => string
  cancelThresholdHours: number
}

type SlotsResponse = {
  slots?: string[]
}

type CalendarData = { dayEntries: CalendarDayEntry[] }

export function RescheduleModal({
  appointment,
  onClose,
  onSuccess,
  ensureAuth,
  formatTime,
  hoursUntil,
  toIsoDate,
  cancelThresholdHours,
}: RescheduleModalProps) {
  const today = useMemo(() => {
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    return base
  }, [])

  const initialMonth = useMemo(() => {
    const start = new Date(appointment.startsAt)
    if (Number.isNaN(start.getTime())) {
      const fallback = new Date()
      fallback.setHours(0, 0, 0, 0)
      fallback.setDate(1)
      return fallback
    }
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    if (start < today) return new Date(today.getFullYear(), today.getMonth(), 1)
    return start
  }, [appointment.startsAt, today])

  const [currentMonth, setCurrentMonth] = useState<Date>(initialMonth)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slotOptions, setSlotOptions] = useState<SlotOption[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slotsMessage, setSlotsMessage] = useState<string>('Selecione um dia disponível para ver horários.')
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { availability, availabilityError, isLoadingAvailability } = useClientAvailability({
    serviceId: appointment.serviceId,
    enabled: Boolean(appointment.serviceId),
    fallbackBufferMinutes: DEFAULT_FALLBACK_BUFFER_MINUTES,
    timezone: DEFAULT_TIMEZONE,
    errorMessage:
      'Não foi possível carregar a disponibilidade. Alguns dias podem não refletir a ocupação real.',
    initialLoading: false,
  })
  const appointmentIsoDay = useMemo(() => appointment.startsAt.slice(0, 10), [appointment.startsAt])

  useEffect(() => {
    if (hoursUntil(appointment.startsAt) >= cancelThresholdHours) {
      setSelectedDate(appointmentIsoDay)
      void loadSlots(appointmentIsoDay)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.id, appointmentIsoDay])

  const calendarHeaderDays = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const startWeekday = firstDay.getDay()
    const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
    return Array.from({ length: 7 }, (_, index) => labels[(startWeekday + index) % 7])
  }, [currentMonth])

  const calendarDays = useMemo<CalendarData>(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const totalDays = new Date(year, month + 1, 0).getDate()

    const dayEntries: CalendarDayEntry[] = []

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day)
      date.setHours(0, 0, 0, 0)
      const iso = toIsoDate(date)

      let state: CalendarDayEntry['state'] = 'available'
      if (availability) {
        if (availability.myDays.has(iso)) state = 'mine'
        else if (availability.bookedDays.has(iso)) state = 'full'
        else if (availability.partiallyBookedDays.has(iso)) state = 'booked'
        else if (availability.availableDays.has(iso)) state = 'available'
      }
      if (iso === appointmentIsoDay) {
        state = 'mine'
      }

      const isPastOrToday = date <= today
      const isDisabled = isPastOrToday || state === 'full'

      dayEntries.push({
        iso,
        day: String(day),
        isDisabled,
        state,
        isOutsideCurrentMonth: false,
      })
    }

    const trailingSpacers = (7 - (dayEntries.length % 7)) % 7
    for (let index = 1; index <= trailingSpacers; index += 1) {
      dayEntries.push({
        iso: `trailing-${year}-${month}-${index}`,
        day: '',
        isDisabled: true,
        state: 'disabled',
        isOutsideCurrentMonth: true,
      })
    }

    return { dayEntries }
  }, [appointmentIsoDay, availability, currentMonth, today, toIsoDate])

  async function loadSlots(iso: string) {
    if (!appointment.serviceId) {
      setErrorMessage('Este agendamento não possui serviço associado para remarcar.')
      return
    }

    setIsLoadingSlots(true)
    setSelectedSlot(null)
    setSlotOptions([])
    setErrorMessage(null)
    setSlotsMessage('Carregando horários disponíveis…')

    try {
      const res = await fetch(`/api/slots?service_id=${encodeURIComponent(appointment.serviceId)}&date=${encodeURIComponent(iso)}`)
      if (!res.ok) {
        setSlotsMessage('Não foi possível carregar os horários disponíveis.')
        return
      }
      const data = (await res.json()) as SlotsResponse
      const slots = (data.slots ?? []).map((slotIso) => {
        const label = formatTime(slotIso)
        const disabled = hoursUntil(slotIso) < cancelThresholdHours
        return { iso: slotIso, label, disabled }
      })
      setSlotOptions(slots)
      if (slots.length === 0) {
        setSlotsMessage('Sem horários para este dia.')
      } else {
        setSlotsMessage('Selecione um horário no dropdown:')
      }
    } catch (error) {
      console.error('Failed to load slots', error)
      setSlotsMessage('Não foi possível carregar os horários disponíveis.')
    } finally {
      setIsLoadingSlots(false)
    }
  }

  const goToPreviousMonth = () => {
    const previous = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    if (previous < today) {
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    } else {
      setCurrentMonth(previous)
    }
  }

  const goToNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    setCurrentMonth(next)
  }

  const monthTitle = useMemo(
    () =>
      currentMonth.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
    [currentMonth],
  )

  const handleDayClick = (iso: string | null, disabled: boolean) => {
    if (!iso || disabled || iso.length !== 10) return
    setSelectedDate(iso)
    void loadSlots(iso)
  }

  const handleSlotChange = (value: string) => {
    setSelectedSlot(value || null)
  }

  const handleSubmit = async () => {
    if (!selectedSlot) return
    const token = await ensureAuth()
    if (!token) return

    setIsSaving(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ starts_at: selectedSlot }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Não foi possível salvar as alterações.' }))
        const message = typeof body.error === 'string' ? body.error : 'Não foi possível salvar as alterações.'
        setErrorMessage(message)
        return
      }

      const payload = await res.json().catch(() => ({ starts_at: selectedSlot, ends_at: null }))
      onSuccess({
        starts_at: typeof payload.starts_at === 'string' ? payload.starts_at : selectedSlot,
        ends_at: typeof payload.ends_at === 'string' ? payload.ends_at : null,
      })
    } catch (error) {
      console.error('Failed to reschedule appointment', error)
      setErrorMessage('Erro inesperado ao salvar as alterações.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ClientModal
      isOpen
      onClose={onClose}
      title="Alterar data e horário"
      tone="info"
      size="lg"
      wrapBody={false}
      disableBackdropClose={isSaving}
      contentClassName={styles.rescheduleModal}
    >
      <div className={`${modalStyles.modalBody} ${modalStyles.modalBodyLeft} ${styles.rescheduleBody}`}>

        <div className={styles.calHead}>
          <button
            type="button"
            className={styles.btnNav}
            onClick={goToPreviousMonth}
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <div className={styles.calTitle}>{monthTitle}</div>
          <button
            type="button"
            className={styles.btnNav}
            onClick={goToNextMonth}
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>

        {isLoadingAvailability ? (
          <div className={styles.meta}>Carregando disponibilidade…</div>
        ) : availabilityError ? (
          <div className={styles.meta}>{availabilityError}</div>
        ) : null}

        <div className={styles.grid} aria-hidden="true">
          {calendarHeaderDays.map((label, index) => (
            <div key={`dow-${index}`} className={styles.gridDow}>
              {label}
            </div>
          ))}
        </div>

        <div className={styles.grid}>
          {calendarDays.dayEntries.map((entry) => (
            <button
              key={entry.iso}
              type="button"
              className={styles.day}
              data-state={entry.state}
              data-selected={!entry.isOutsideCurrentMonth && selectedDate === entry.iso}
              data-outside-month={entry.isOutsideCurrentMonth ? 'true' : 'false'}
              aria-disabled={entry.isDisabled}
              disabled={entry.isDisabled}
              onClick={() => handleDayClick(entry.iso, entry.isDisabled || entry.isOutsideCurrentMonth)}
            >
              {entry.day}
            </button>
          ))}
        </div>

        <div className={styles.label}>Horários disponíveis</div>
        <div className={`${styles.slots} ${styles.slotsDropdownLayout}`}>
          {isLoadingSlots ? (
            <div className={styles.meta}>{slotsMessage}</div>
          ) : slotOptions.length > 0 ? (
            <>
              <label className={styles.slotDropdown} htmlFor="slotSelect">
                <span className={styles.visuallyHidden}>Selecione um horário</span>
                <select
                  id="slotSelect"
                  className={styles.slotSelect}
                  value={selectedSlot ?? ''}
                  onChange={(event) => handleSlotChange(event.target.value)}
                  disabled={isSaving}
                >
                  <option value="" disabled>
                    Selecione um horário
                  </option>
                  {slotOptions.map((option) => (
                    <option key={option.iso} value={option.iso} disabled={option.disabled}>
                      {option.label}
                      {option.disabled ? ' (indisponível)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.meta}>{slotsMessage}</div>
            </>
          ) : (
            <div className={styles.meta}>{slotsMessage}</div>
          )}
        </div>
      </div>

      {errorMessage ? <div className={modalStyles.modalAlert}>{errorMessage}</div> : null}

      <div className={modalStyles.modalActions}>
        <button
          type="button"
          className={`${modalStyles.modalButton} ${modalStyles.modalButtonSecondary}`}
          disabled={isSaving}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={`${modalStyles.modalButton} ${modalStyles.modalButtonSuccess}`}
          disabled={!selectedSlot || isSaving}
          onClick={handleSubmit}
        >
          {isSaving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </ClientModal>
  )
}
