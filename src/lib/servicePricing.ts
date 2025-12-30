import type { SupabaseClient } from '@supabase/supabase-js'

export type ServiceBaseValues = {
  base_duration_min?: number | null
  base_price_cents?: number | null
  base_deposit_cents?: number | null
  base_buffer_min?: number | null
}

export type ServiceAssignmentOverride = {
  use_service_defaults?: boolean | null
  override_duration_min?: number | null
  override_price_cents?: number | null
  override_deposit_cents?: number | null
  override_buffer_min?: number | null
}

export type ResolvedServiceValues = {
  duration_min: number
  price_cents: number
  deposit_cents: number
  buffer_min: number
}

const normalizeInt = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.round(parsed)
    }
  }

  return null
}

export function resolveFinalServiceValues(
  baseValues: ServiceBaseValues,
  assignment?: ServiceAssignmentOverride | null,
): ResolvedServiceValues {
  const baseDuration = Math.max(0, normalizeInt(baseValues.base_duration_min) ?? 0)
  const basePrice = Math.max(0, normalizeInt(baseValues.base_price_cents) ?? 0)
  const baseDepositRaw = Math.max(0, normalizeInt(baseValues.base_deposit_cents) ?? 0)
  const baseDeposit = Math.min(basePrice, baseDepositRaw)
  const baseBuffer = Math.max(0, normalizeInt(baseValues.base_buffer_min) ?? 0)

  const useDefaults = assignment?.use_service_defaults !== false

  const duration = useDefaults
    ? baseDuration
    : Math.max(0, normalizeInt(assignment?.override_duration_min) ?? baseDuration)

  const price = useDefaults
    ? basePrice
    : Math.max(0, normalizeInt(assignment?.override_price_cents) ?? basePrice)

  const depositRaw = useDefaults
    ? baseDeposit
    : Math.max(0, normalizeInt(assignment?.override_deposit_cents) ?? baseDeposit)
  const deposit = Math.min(price, depositRaw)

  const buffer = useDefaults
    ? baseBuffer
    : Math.max(0, normalizeInt(assignment?.override_buffer_min) ?? baseBuffer)

  return {
    duration_min: duration,
    price_cents: price,
    deposit_cents: deposit,
    buffer_min: buffer,
  }
}

export type AssignmentPricingResult = {
  serviceTypeId: string | null
  finalValues: ResolvedServiceValues
}

type AssignmentRow = {
  service_type_id?: string | null
  use_service_defaults?: boolean | null
  override_duration_min?: number | null
  override_price_cents?: number | null
  override_deposit_cents?: number | null
  override_buffer_min?: number | null
  service_type?:
    | {
        id?: string | null
        active?: boolean | null
        base_duration_min?: number | null
        base_price_cents?: number | null
        base_deposit_cents?: number | null
        base_buffer_min?: number | null
      }
    | {
        id?: string | null
        active?: boolean | null
        base_duration_min?: number | null
        base_price_cents?: number | null
        base_deposit_cents?: number | null
        base_buffer_min?: number | null
      }[]
    | null
}

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined) return []
  return [value]
}

export async function resolveServicePricing(
  client: SupabaseClient,
  serviceId: string,
  preferredServiceTypeId?: string | null,
): Promise<AssignmentPricingResult | null> {
  const { data, error } = await client
    .from('service_type_assignments')
    .select(
      `service_type_id, use_service_defaults, override_duration_min, override_price_cents, override_deposit_cents, override_buffer_min,
       service_type:service_types(id, active, base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min)`
    )
    .eq('service_id', serviceId)
    .order('created_at', { ascending: true, nullsFirst: true })
    .order('service_type_id', { ascending: true, nullsFirst: true })

  if (error) {
    throw error
  }

  const assignments = (data ?? []) as AssignmentRow[]
  const normalized = assignments.filter((entry) => {
    const serviceType = toArray(entry.service_type).find((item) => item && typeof item === 'object')
    return serviceType?.active !== false
  })

  const matchByPreference = preferredServiceTypeId
    ? normalized.find((entry) => entry.service_type_id === preferredServiceTypeId)
    : null

  const picked = matchByPreference ?? normalized[0]
  const serviceType = toArray(picked?.service_type).find((item) => item && typeof item === 'object')

  if (!picked || !serviceType) {
    return null
  }

  const finalValues = resolveFinalServiceValues(
    {
      base_duration_min: serviceType.base_duration_min ?? 0,
      base_price_cents: serviceType.base_price_cents ?? 0,
      base_deposit_cents: serviceType.base_deposit_cents ?? 0,
      base_buffer_min: serviceType.base_buffer_min ?? 0,
    },
    picked,
  )

  return {
    serviceTypeId: picked.service_type_id ?? serviceType.id ?? null,
    finalValues,
  }
}
