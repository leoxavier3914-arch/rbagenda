export type AppointmentStatus = 'pending' | 'reserved' | 'confirmed' | 'canceled' | 'completed'

export type StatusCategory = 'ativos' | 'pendentes' | 'cancelados' | 'concluidos'
export type SelectedStatusCategory = StatusCategory | null

export type NormalizedAppointment = {
  id: string
  serviceId: string | null
  serviceTypeId: string | null
  startsAt: string
  endsAt: string | null
  status: AppointmentStatus
  serviceType: string
  serviceTechnique: string | null
  totalValue: number
  depositValue: number
  paidValue: number
}

export type CancelDialogState = {
  variant: 'standard' | 'penalty'
  appointment: NormalizedAppointment
} | null

export type SuccessDialogState = {
  title: string
  message: string
} | null

export type SlotOption = {
  iso: string
  label: string
  disabled: boolean
}

export type CalendarDayEntry = {
  iso: string
  day: string
  isDisabled: boolean
  state: 'available' | 'booked' | 'full' | 'mine' | 'disabled'
  isOutsideCurrentMonth: boolean
}
