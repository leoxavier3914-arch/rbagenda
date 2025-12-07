import { useCallback, useEffect, useRef, useState } from 'react'

import { supabase } from '@/lib/db'
import {
  DEFAULT_FALLBACK_BUFFER_MINUTES,
  DEFAULT_TIMEZONE,
  buildAvailabilityData,
  type AvailabilityAppointment,
} from '@/lib/availability'

type AvailabilitySnapshot = ReturnType<typeof buildAvailabilityData>

type LoadOptions = { withLoading?: boolean }

type UseClientAvailabilityOptions = {
  serviceId?: string | null
  enabled?: boolean
  subscribe?: boolean
  channel?: string
  fallbackBufferMinutes?: number
  timezone?: string
  errorMessage?: string
  initialLoading?: boolean
}

type UseClientAvailabilityResult = {
  availability: AvailabilitySnapshot | null
  isLoadingAvailability: boolean
  availabilityError: string | null
  reloadAvailability: (options?: LoadOptions) => Promise<void>
}

const relevantStatuses = new Set(['pending', 'reserved', 'confirmed'])

export function useClientAvailability(options: UseClientAvailabilityOptions): UseClientAvailabilityResult {
  const {
    serviceId,
    enabled = true,
    subscribe = false,
    channel,
    fallbackBufferMinutes = DEFAULT_FALLBACK_BUFFER_MINUTES,
    timezone = DEFAULT_TIMEZONE,
    errorMessage = 'Não foi possível carregar a disponibilidade. Tente novamente mais tarde.',
    initialLoading = true,
  } = options

  const [availability, setAvailability] = useState<AvailabilitySnapshot | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(initialLoading)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadAvailability = useCallback(
    async ({ withLoading = true }: LoadOptions = {}) => {
      if (!enabled || (serviceId !== undefined && !serviceId)) {
        if (!isMountedRef.current) return
        setAvailability(null)
        setAvailabilityError(null)
        if (withLoading) {
          setIsLoadingAvailability(false)
        }
        return
      }

      if (withLoading) {
        setIsLoadingAvailability(true)
        setAvailabilityError(null)
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        const session = sessionData.session
        if (!session?.user?.id) {
          window.location.href = '/login'
          return
        }

        if (!isMountedRef.current) return

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const limit = new Date(today)
        limit.setDate(limit.getDate() + 60)

        let query = supabase
          .from('appointments')
          .select('id, scheduled_at, starts_at, ends_at, status, customer_id, services(buffer_min)')
          .gte('starts_at', today.toISOString())
          .lte('starts_at', limit.toISOString())
          .in('status', ['pending', 'reserved', 'confirmed'])
          .order('starts_at', { ascending: true })

        if (serviceId) {
          query = query.eq('service_id', serviceId)
        }

        const { data, error } = await query.returns<AvailabilityAppointment[]>()

        if (error) throw error
        if (!isMountedRef.current) return

        const snapshot = buildAvailabilityData(data ?? [], session.user.id, {
          fallbackBufferMinutes,
          timezone,
        })

        setAvailability(snapshot)
        setAvailabilityError(null)
      } catch (err) {
        console.error('Erro ao carregar disponibilidade', err)
        if (isMountedRef.current) {
          setAvailability(null)
          setAvailabilityError(errorMessage)
        }
      } finally {
        if (withLoading && isMountedRef.current) {
          setIsLoadingAvailability(false)
        }
      }
    },
    [enabled, serviceId, fallbackBufferMinutes, timezone, errorMessage],
  )

  useEffect(() => {
    void loadAvailability({ withLoading: true })
  }, [loadAvailability])

  useEffect(() => {
    if (!subscribe || !enabled) return undefined

    const isRecordRelevant = (record: Partial<AvailabilityAppointment> | null | undefined) => {
      if (!record) return false

      const status = record.status
      if (!status || !relevantStatuses.has(status)) return false

      const rawStart: string | null = record.scheduled_at ?? record.starts_at ?? null
      if (!rawStart) return false

      const start = new Date(rawStart)
      if (Number.isNaN(start.getTime())) return false

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const limit = new Date(today)
      limit.setDate(limit.getDate() + 60)

      return start >= today && start <= limit
    }

    const availabilityChannel = supabase
      .channel(channel ?? 'client-availability')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          if (!isMountedRef.current) return

          const { new: newRecord, old: oldRecord } = payload

          if (isRecordRelevant(newRecord as AvailabilityAppointment) || isRecordRelevant(oldRecord as AvailabilityAppointment)) {
            void loadAvailability({ withLoading: false })
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(availabilityChannel)
    }
  }, [channel, enabled, loadAvailability, subscribe])

  return { availability, isLoadingAvailability, availabilityError, reloadAvailability: loadAvailability }
}
