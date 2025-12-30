'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import {
  ClientGlassPanel,
  ClientPageHeader,
  ClientPageShell,
  ClientSection,
} from '@/components/client/ClientPageLayout'
import { useClientPageReady } from '@/hooks/useClientPageReady'
import { useClientSessionGuard } from '@/hooks/useClientSessionGuard'
import { supabase } from '@/lib/db'
import { resolveFinalServiceValues } from '@/lib/servicePricing'

import styles from './catalogo.module.css'

type CategoryRow = { id?: string | null; name?: string | null }

type ServiceTypeRow = {
  id: string
  name?: string | null
  active?: boolean | null
  category?: CategoryRow | CategoryRow[] | null
  base_duration_min?: number | null
  base_price_cents?: number | null
  base_deposit_cents?: number | null
  base_buffer_min?: number | null
}

type AssignmentRow = {
  use_service_defaults?: boolean | null
  override_duration_min?: number | null
  override_price_cents?: number | null
  override_deposit_cents?: number | null
  override_buffer_min?: number | null
  service_type?: ServiceTypeRow | ServiceTypeRow[] | null
}

type ServicePhotoRow = {
  id: string
  url?: string | null
  order_index?: number | null
}

type ServiceRow = {
  id: string
  name?: string | null
  description?: string | null
  active?: boolean | null
  assignments?: AssignmentRow[] | AssignmentRow | null
  photos?: ServicePhotoRow[] | ServicePhotoRow | null
}

type CatalogServiceType = {
  id: string
  name: string
  categoryName: string | null
  price: number
  deposit: number
  duration: number
}

type CatalogOption = {
  id: string
  name: string
  description: string | null
  coverUrl: string | null
  gallery: string[]
  serviceTypes: CatalogServiceType[]
}

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error'

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined) return []
  return [value]
}

const formatPrice = (cents: number) => {
  const safe = Number.isFinite(cents) ? Math.max(0, cents) : 0
  return `R$ ${(safe / 100).toFixed(2)}`
}

const formatDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Sob consulta'
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (remaining > 0) parts.push(`${remaining} min`)
  return parts.join(' ') || 'Sob consulta'
}

const normalizeOrderIndex = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY

const normalizeOption = (entry: ServiceRow): CatalogOption | null => {
  const serviceTypes = toArray(entry.assignments).reduce<Map<string, CatalogServiceType>>((map, assignment) => {
    const serviceType = toArray(assignment?.service_type).find((item) => item && typeof item === 'object')
    if (!serviceType?.id || serviceType.active === false) return map

    const category = toArray(serviceType.category).find((cat) => cat && typeof cat === 'object')
    const finalValues = resolveFinalServiceValues(
      {
        base_duration_min: serviceType.base_duration_min ?? 0,
        base_price_cents: serviceType.base_price_cents ?? 0,
        base_deposit_cents: serviceType.base_deposit_cents ?? 0,
        base_buffer_min: serviceType.base_buffer_min ?? 0,
      },
      {
        use_service_defaults: assignment?.use_service_defaults ?? true,
        override_duration_min: assignment?.override_duration_min ?? null,
        override_price_cents: assignment?.override_price_cents ?? null,
        override_deposit_cents: assignment?.override_deposit_cents ?? null,
        override_buffer_min: assignment?.override_buffer_min ?? null,
      },
    )

    if (map.has(serviceType.id)) return map

    map.set(serviceType.id, {
      id: serviceType.id,
      name: serviceType.name ?? 'Serviço',
      categoryName: category?.name ?? null,
      price: finalValues.price_cents,
      deposit: finalValues.deposit_cents,
      duration: finalValues.duration_min,
    })

    return map
  }, new Map())

  const sortedServiceTypes = Array.from(serviceTypes.values()).sort((a, b) => {
    if (a.categoryName && b.categoryName && a.categoryName !== b.categoryName) {
      return a.categoryName.localeCompare(b.categoryName, 'pt-BR')
    }
    return a.name.localeCompare(b.name, 'pt-BR')
  })

  const photos = toArray(entry.photos)
    .filter((photo) => typeof photo?.url === 'string' && photo.url)
    .sort((a, b) => {
      return normalizeOrderIndex(a.order_index) - normalizeOrderIndex(b.order_index)
    })

  const gallery = photos.map((photo) => photo.url as string)
  const coverUrl = gallery[0] ?? null

  if (entry.active === false || sortedServiceTypes.length === 0) return null

  return {
    id: entry.id,
    name: entry.name ?? 'Opção',
    description: entry.description ?? null,
    coverUrl,
    gallery,
    serviceTypes: sortedServiceTypes,
  }
}

export default function CatalogoPage() {
  const heroReady = useClientPageReady()
  useClientSessionGuard()

  const [catalog, setCatalog] = useState<CatalogOption[]>([])
  const [status, setStatus] = useState<CatalogStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      setStatus('loading')
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('services')
        .select(
          `id, name, description, active,
           assignments:service_type_assignments(use_service_defaults, override_duration_min, override_price_cents, override_deposit_cents, override_buffer_min, service_type:service_types(id, name, active, category:service_categories(id, name), base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min)),
           photos:service_photos(id, url, order_index)`,
        )
        .eq('active', true)
        .order('name', { ascending: true })

      if (!active) return

      if (fetchError) {
        console.error('Erro ao carregar catálogo', fetchError)
        setCatalog([])
        setError('Não foi possível carregar o catálogo no momento. Tente novamente mais tarde.')
        setStatus('error')
        return
      }

      const normalized = (data ?? []).map(normalizeOption).filter(Boolean) as CatalogOption[]
      setCatalog(normalized)
      setStatus('ready')
    }

    void loadCatalog()

    return () => {
      active = false
    }
  }, [])

  const heroSubtitle = useMemo(
    () =>
      'Explore todas as opções disponíveis, veja fotos reais e encontre rapidamente o que combina melhor com o seu atendimento.',
    [],
  )

  return (
    <ClientPageShell heroReady={heroReady} forceMotion>
      <ClientSection className={styles.section}>
        <div className={styles.headerArea}>
          <span className="badge">Catálogo</span>
          <ClientPageHeader
            title="Catálogo do estúdio"
            subtitle={heroSubtitle}
            className={styles.header}
            subtitleClassName={styles.subtitle}
          />
        </div>

        <ClientGlassPanel label="OPÇÕES DISPONÍVEIS" className={styles.panel}>
          {status === 'loading' ? <p className={styles.helper}>Carregando catálogo...</p> : null}
          {status === 'error' ? (
            <p className={`${styles.helper} ${styles.error}`}>{error ?? 'Algo deu errado ao carregar o catálogo.'}</p>
          ) : null}
          {status === 'ready' && catalog.length === 0 ? (
            <p className={styles.helper}>Nenhuma opção ativa no momento.</p>
          ) : null}

          {catalog.length ? (
            <div className={styles.grid}>
              {catalog.map((option) => {
                const primaryService = option.serviceTypes[0]

                return (
                  <article key={option.id} className={styles.card}>
                    <div className={styles.coverWrapper}>
                      {option.coverUrl ? (
                        <div
                          className={styles.cover}
                          style={{ backgroundImage: `url(${option.coverUrl})` }}
                          role="img"
                          aria-label={`Foto da opção ${option.name}`}
                        />
                      ) : (
                        <div className={styles.coverPlaceholder}>Fotos em breve</div>
                      )}
                      <div className={styles.photoBadge}>
                        {option.gallery.length > 0
                          ? `${option.gallery.length} foto${option.gallery.length > 1 ? 's' : ''}`
                          : 'Sem fotos'}
                      </div>
                    </div>

                    <div className={styles.cardBody}>
                      {option.serviceTypes.length ? (
                        <div className={styles.tags} aria-label="Serviços relacionados">
                          {option.serviceTypes.map((serviceType) => (
                            <span key={serviceType.id} className={styles.tag}>
                              {serviceType.categoryName ? `${serviceType.categoryName} · ` : ''}
                              {serviceType.name}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <h3 className={styles.optionTitle}>{option.name}</h3>
                      {option.description ? (
                        <p className={styles.optionDescription}>{option.description}</p>
                      ) : (
                        <p className={styles.optionDescriptionMuted}>Sem descrição cadastrada.</p>
                      )}

                      {primaryService ? (
                        <dl className={styles.meta} aria-label="Faixa de preço e duração estimada">
                          <div>
                            <dt>Valor</dt>
                            <dd>{formatPrice(primaryService.price)}</dd>
                          </div>
                          <div>
                            <dt>Duração</dt>
                            <dd>{formatDuration(primaryService.duration)}</dd>
                          </div>
                          <div>
                            <dt>Sinal</dt>
                            <dd>{formatPrice(primaryService.deposit)}</dd>
                          </div>
                        </dl>
                      ) : null}

                      <div className={styles.cardFooter}>
                        <Link className={styles.cta} href="/procedimento">
                          Agendar
                        </Link>
                        <span className={styles.footerHint}>
                          Valores seguem o serviço principal. Confirme ao escolher o procedimento.
                        </span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}
        </ClientGlassPanel>
      </ClientSection>
    </ClientPageShell>
  )
}
