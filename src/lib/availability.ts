import { addDays } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

export type AvailabilityAppointment = {
  id: string
  scheduled_at: string | null
  starts_at: string
  ends_at: string | null
  status: string
  customer_id: string | null
  services?:
    | { buffer_min?: number | null }[]
    | { buffer_min?: number | null }
    | null
}

export type AvailabilityData = {
  availableDays: Set<string>
  partiallyBookedDays: Set<string>
  bookedDays: Set<string>
  myDays: Set<string>
  daySlots: Record<string, string[]>
  bookedSlots: Record<string, string[]>
  busyIntervals: Record<string, Array<{ start: string; end: string }>>
}

export type BuildAvailabilityOptions = {
  fallbackBufferMinutes?: number
  days?: number
  slotTemplate?: string[]
  timezone?: string
}

export const DEFAULT_TIMEZONE =
  process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ||
  process.env.DEFAULT_TIMEZONE ||
  'America/Sao_Paulo'

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function makeSlots(start = '09:00', end = '18:00', stepMinutes = 30) {
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  const slots: string[] = []
  let cursor = new Date(2000, 0, 1, startHour ?? 0, startMinute ?? 0, 0, 0)
  const limit = new Date(2000, 0, 1, endHour ?? 0, endMinute ?? 0, 0, 0)

  while (cursor <= limit) {
    const hours = String(cursor.getHours()).padStart(2, '0')
    const minutes = String(cursor.getMinutes()).padStart(2, '0')
    slots.push(`${hours}:${minutes}`)
    cursor = new Date(cursor.getTime() + (stepMinutes || 30) * 60000)
  }

  return slots
}

export const DEFAULT_SLOT_TEMPLATE = makeSlots('09:00', '18:00', 30)

export const DEFAULT_FALLBACK_BUFFER_MINUTES =
  Number(process.env.NEXT_PUBLIC_DEFAULT_BUFFER_MIN ?? '15') || 15

export function formatDateToIsoDay(date: Date, timeZone?: string) {
  if (timeZone) {
    return formatInTimeZone(date, timeZone, 'yyyy-MM-dd')
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getBufferMinutesFromAppointment(
  appt: AvailabilityAppointment,
  fallback: number,
): number {
  const entries = Array.isArray(appt.services)
    ? appt.services
    : appt.services
    ? [appt.services]
    : []

  for (const entry of entries) {
    const normalized = normalizeNumber(entry?.buffer_min)
    if (normalized !== null) {
      return Math.max(0, normalized)
    }
  }

  return Math.max(0, fallback)
}

export function buildAvailabilityData(
  appointments: AvailabilityAppointment[],
  userId: string | null,
  options: BuildAvailabilityOptions = {},
): AvailabilityData {
  const fallbackBufferMinutes = Math.max(
    0,
    options.fallbackBufferMinutes ?? DEFAULT_FALLBACK_BUFFER_MINUTES,
  )
  const totalDays = Math.max(1, options.days ?? 60)
  const slotTemplate = options.slotTemplate ?? DEFAULT_SLOT_TEMPLATE
  const timezone = options.timezone?.trim() || DEFAULT_TIMEZONE

  const todayIso = formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd')
  let currentDay = fromZonedTime(`${todayIso}T00:00:00`, timezone)

  const daySlots: Record<string, string[]> = {}
  const bookedSlots: Record<string, string[]> = {}
  const busyIntervals: Record<string, Array<{ start: string; end: string }>> = {}
  const availableDays = new Set<string>()
  const partiallyBookedDays = new Set<string>()
  const bookedDays = new Set<string>()
  const myDays = new Set<string>()

  const perDay = new Map<
    string,
    { times: Set<string>; myTimes: Set<string>; intervals: Array<{ start: string; end: string }> }
  >()

  appointments.forEach((appt) => {
    const rawStart = appt.scheduled_at ?? appt.starts_at
    if (!rawStart) return
    const start = new Date(rawStart)
    if (Number.isNaN(start.getTime())) return
    const isoDay = formatInTimeZone(start, timezone, 'yyyy-MM-dd')
    const time = formatInTimeZone(start, timezone, 'HH:mm')
    const rawEnd = appt.ends_at ? new Date(appt.ends_at) : new Date(start.getTime() + 60 * 60000)
    if (Number.isNaN(rawEnd.getTime())) return
    const bufferMinutes = getBufferMinutesFromAppointment(appt, fallbackBufferMinutes)
    const endWithBuffer = new Date(rawEnd.getTime() + bufferMinutes * 60000)

    if (!perDay.has(isoDay)) {
      perDay.set(isoDay, { times: new Set(), myTimes: new Set(), intervals: [] })
    }

    const entry = perDay.get(isoDay)!
    entry.times.add(time)
    entry.intervals.push({ start: start.toISOString(), end: endWithBuffer.toISOString() })
    if (userId && appt.customer_id === userId) {
      entry.myTimes.add(time)
    }
  })

  for (let i = 0; i < totalDays; i += 1) {
    const iso = formatInTimeZone(currentDay, timezone, 'yyyy-MM-dd')
    daySlots[iso] = [...slotTemplate]

    const entry = perDay.get(iso)
    if (entry) {
      const sortedTimes = Array.from(entry.times).sort()
      if (sortedTimes.length > 0) {
        bookedSlots[iso] = sortedTimes
      }

      if (entry.intervals.length > 0) {
        busyIntervals[iso] = entry.intervals.sort((a, b) => a.start.localeCompare(b.start))
      }

      if (entry.myTimes.size > 0) {
        myDays.add(iso)
      }

      if (entry.myTimes.size === 0) {
        const totalSlots = daySlots[iso]?.length ?? slotTemplate.length
        if (entry.times.size >= totalSlots) {
          bookedDays.add(iso)
        } else if (entry.times.size > 0) {
          partiallyBookedDays.add(iso)
        } else {
          availableDays.add(iso)
        }
      }
    } else {
      availableDays.add(iso)
    }

    currentDay = addDays(currentDay, 1)
  }

  return {
    availableDays,
    partiallyBookedDays,
    bookedDays,
    myDays,
    daySlots,
    bookedSlots,
    busyIntervals,
  }
}
