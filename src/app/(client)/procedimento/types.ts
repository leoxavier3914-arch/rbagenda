export type ServiceTechnique = {
  id: string
  name: string
  slug: string | null
  duration_min: number
  price_cents: number
  deposit_cents: number
  buffer_min: number
  active: boolean
}

export type ServiceTypeAssignment = {
  services?: ServiceTechnique | ServiceTechnique[] | null
  use_service_defaults?: boolean | null
  override_duration_min?: number | null
  override_price_cents?: number | null
  override_deposit_cents?: number | null
  override_buffer_min?: number | null
}

export type TechniqueCatalogEntry = {
  id: string
  name: string
  slug: string | null
  description: string | null
  order_index: number
  active: boolean
  services: ServiceTechnique[]
}

export type SummarySnapshot = {
  typeId: string
  typeName: string
  techniqueId: string
  techniqueName: string
  priceLabel: string
  priceCents: number
  depositLabel: string
  depositCents: number
  durationLabel: string
  dateLabel: string
  timeLabel: string
  payload: {
    typeId: string
    serviceId: string
    date: string
    slot: string
  }
}

export type TimePeriod = 'all' | 'morning' | 'afternoon' | 'night'
