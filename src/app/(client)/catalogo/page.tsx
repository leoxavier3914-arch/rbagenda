'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

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
  categoryId: string | null
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
type CategoryOption = { id: string; name: string }

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

const servicePhotosBucket = 'service-photos'
const ALL_CATEGORIES = '__all__'
const ALL_SERVICES = '__all_services__'
const UNCATEGORIZED_CATEGORY = '__uncategorized__'

const normalizeCategoryId = (value: string | null | undefined) => value ?? UNCATEGORIZED_CATEGORY
const resolveCategoryLabel = (value: string | null | undefined) => value ?? 'Sem categoria'

const isHttpUrl = (value: string | null | undefined) => {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return Boolean(parsed.protocol && parsed.host)
  } catch {
    return false
  }
}

const normalizeStoragePath = (value: string | null | undefined) => {
  if (!value) return null
  if (isHttpUrl(value)) {
    try {
      const parsed = new URL(value)
      const publicPrefix = '/storage/v1/object/public/service-photos/'
      if (parsed.pathname.includes(publicPrefix)) {
        const normalized = parsed.pathname.split(publicPrefix)[1] ?? ''
        return decodeURIComponent(normalized).replace(/^service-photos\//, '')
      }
      const signedPrefix = '/storage/v1/object/sign/service-photos/'
      if (parsed.pathname.includes(signedPrefix)) {
        const normalized = parsed.pathname.split(signedPrefix)[1] ?? ''
        return decodeURIComponent(normalized).split('?')[0]?.replace(/^service-photos\//, '') ?? ''
      }
    } catch {
      // ignore
    }
  }
  const normalized = value.replace(/^service-photos\//, '').replace(/^\//, '')
  return normalized.length ? normalized : null
}

const resolveSignedPhotoUrls = async (options: CatalogOption[]): Promise<CatalogOption[]> => {
  const pathsToSign = new Set<string>()

  options.forEach((option) => {
    option.gallery.forEach((entry) => {
      const normalized = normalizeStoragePath(entry)
      if (normalized && !isHttpUrl(entry)) {
        pathsToSign.add(normalized)
      }
    })
  })

  if (pathsToSign.size === 0) return options

  const { data: signedData, error: signedError } = await supabase.storage
    .from(servicePhotosBucket)
    .createSignedUrls(Array.from(pathsToSign), 60 * 60)

  if (signedError) {
    console.error('Erro ao gerar URLs assinadas do catálogo', signedError)
    return options
  }

  const signedByPath = new Map<string, string>()
  ;(signedData ?? []).forEach((entry) => {
    if (entry.path && entry.signedUrl) {
      signedByPath.set(entry.path, entry.signedUrl)
    }
  })

  const resolveUrl = (original: string | null): string | null => {
    if (!original) return null
    if (isHttpUrl(original)) return original

    const normalized = normalizeStoragePath(original)
    if (!normalized) return original

    return signedByPath.get(normalized) ?? original
  }

  return options.map((option) => {
    const gallery = option.gallery
      .map((entry) => resolveUrl(entry))
      .filter(Boolean) as string[]

    return { ...option, gallery, coverUrl: gallery[0] ?? null }
  })
}

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
      categoryId: category?.id ?? null,
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string | null>(null)
  const [onlyFeatured, setOnlyFeatured] = useState(false)

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
      const withSignedPhotos = await resolveSignedPhotoUrls(normalized)

      if (!active) return

      setCatalog(withSignedPhotos)
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

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const map = new Map<string, CategoryOption>()

    catalog.forEach((option) => {
      option.serviceTypes.forEach((serviceType) => {
        const normalizedId = normalizeCategoryId(serviceType.categoryId)
        if (!map.has(normalizedId)) {
          map.set(normalizedId, {
            id: normalizedId,
            name: resolveCategoryLabel(serviceType.categoryName),
          })
        }
      })
    })

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [catalog])

  const hasMultipleCategories = categoryOptions.length > 1

  useEffect(() => {
    if (categoryOptions.length === 1) {
      setSelectedCategoryId(categoryOptions[0]?.id ?? null)
      return
    }

    if (categoryOptions.length > 1 && selectedCategoryId === null) {
      setSelectedCategoryId(ALL_CATEGORIES)
      return
    }

    if (categoryOptions.length === 0) {
      setSelectedCategoryId(null)
    }
  }, [categoryOptions, selectedCategoryId])

  const activeCategoryId = useMemo(() => {
    if (hasMultipleCategories) return selectedCategoryId
    if (categoryOptions.length === 1) return categoryOptions[0]?.id ?? null
    return selectedCategoryId
  }, [categoryOptions, hasMultipleCategories, selectedCategoryId])

  const serviceOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()

    catalog.forEach((option) => {
      option.serviceTypes.forEach((serviceType) => {
        if (
          activeCategoryId &&
          activeCategoryId !== ALL_CATEGORIES &&
          normalizeCategoryId(serviceType.categoryId) !== activeCategoryId
        ) {
          return
        }

        if (!map.has(serviceType.id)) {
          map.set(serviceType.id, { id: serviceType.id, name: serviceType.name })
        }
      })
    })

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [activeCategoryId, catalog])

  useEffect(() => {
    if (!selectedServiceTypeId) return
    const stillExists = serviceOptions.some((option) => option.id === selectedServiceTypeId)
    if (!stillExists) {
      setSelectedServiceTypeId(null)
    }
  }, [selectedServiceTypeId, serviceOptions])

  const resolvePrimaryService = useCallback(
    (option: CatalogOption): CatalogServiceType | null => {
      if (selectedServiceTypeId) {
        const byService = option.serviceTypes.find((serviceType) => serviceType.id === selectedServiceTypeId)
        if (byService) return byService
      }

      if (activeCategoryId && activeCategoryId !== ALL_CATEGORIES) {
        const byCategory = option.serviceTypes.find(
          (serviceType) => normalizeCategoryId(serviceType.categoryId) === activeCategoryId,
        )
        if (byCategory) return byCategory
      }

      return option.serviceTypes[0] ?? null
    },
    [activeCategoryId, selectedServiceTypeId],
  )

  const filteredCatalog = useMemo(
    () =>
      catalog
        .filter((option) => {
          const matchesCategory =
            activeCategoryId && activeCategoryId !== ALL_CATEGORIES
              ? option.serviceTypes.some((serviceType) => normalizeCategoryId(serviceType.categoryId) === activeCategoryId)
              : true

          const matchesService = selectedServiceTypeId
            ? option.serviceTypes.some((serviceType) => serviceType.id === selectedServiceTypeId)
            : true

          const matchesFeatured = onlyFeatured ? option.gallery.length > 0 : true

          return matchesCategory && matchesService && matchesFeatured
        })
        .map((option) => ({
          option,
          primaryService: resolvePrimaryService(option),
        })),
    [activeCategoryId, catalog, onlyFeatured, resolvePrimaryService, selectedServiceTypeId],
  )

  const activeCategoryLabel = useMemo(() => {
    if (!activeCategoryId) return null
    if (activeCategoryId === ALL_CATEGORIES) return 'Todas as categorias'
    return categoryOptions.find((item) => item.id === activeCategoryId)?.name ?? null
  }, [activeCategoryId, categoryOptions])

  return (
    <ClientPageShell heroReady={heroReady} forceMotion>
      <ClientSection className={styles.section}>
        <div className={styles.headerArea}>
          <ClientPageHeader
            title="Catálogo do estúdio"
            subtitle={heroSubtitle}
            className={styles.header}
            subtitleClassName={styles.subtitle}
          />
        </div>

        <ClientGlassPanel label="OPÇÕES DISPONÍVEIS" className={styles.panel}>
          {hasMultipleCategories ? (
            <div className={styles.filters}>
              <div className={styles.filterGroup}>
                <label htmlFor="catalog-category" className={styles.filterLabel}>
                  Categoria
                </label>
                <select
                  id="catalog-category"
                  className={styles.select}
                  value={activeCategoryId ?? ALL_CATEGORIES}
                  onChange={(event) => {
                    const value = event.target.value
                    setSelectedCategoryId(value === ALL_CATEGORIES ? ALL_CATEGORIES : value)
                  }}
                >
                  <option value={ALL_CATEGORIES}>Todas as categorias</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label htmlFor="catalog-service" className={styles.filterLabel}>
                  Serviços
                </label>
                <select
                  id="catalog-service"
                  className={styles.select}
                  value={selectedServiceTypeId ?? ALL_SERVICES}
                  onChange={(event) => {
                    const value = event.target.value
                    setSelectedServiceTypeId(value === ALL_SERVICES ? null : value)
                  }}
                >
                  <option value={ALL_SERVICES}>Todos os serviços</option>
                  {serviceOptions.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Destaques</span>
                <button
                  type="button"
                  className={`${styles.toggle} ${onlyFeatured ? styles.toggleActive : ''}`}
                  onClick={() => setOnlyFeatured((previous) => !previous)}
                >
                  Somente opções com fotos
                </button>
              </div>
            </div>
          ) : null}

          {activeCategoryLabel ? (
            <div className={styles.selectedCategory}>
              <span className={styles.selectedCategoryLabel}>Categoria</span>
              <span className={styles.categoryBadge}>{activeCategoryLabel}</span>
            </div>
          ) : null}

          {status === 'loading' ? <p className={styles.helper}>Carregando catálogo...</p> : null}
          {status === 'error' ? (
            <p className={`${styles.helper} ${styles.error}`}>{error ?? 'Algo deu errado ao carregar o catálogo.'}</p>
          ) : null}
          {status === 'ready' && catalog.length === 0 ? (
            <p className={styles.helper}>Nenhuma opção ativa no momento.</p>
          ) : null}
          {status === 'ready' && catalog.length > 0 && filteredCatalog.length === 0 ? (
            <p className={styles.helper}>Nenhuma opção encontrada com os filtros selecionados.</p>
          ) : null}

          {filteredCatalog.length ? (
            <div className={styles.grid}>
              {filteredCatalog.map(({ option, primaryService }) => {
                const service = primaryService ?? option.serviceTypes[0]

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
                      {service ? (
                        <div className={styles.tags} aria-label="Serviços relacionados">
                          <span key={service.id} className={styles.tag}>
                            {service.name}
                          </span>
                        </div>
                      ) : null}

                      <h3 className={styles.optionTitle}>{option.name}</h3>
                      {option.description ? (
                        <p className={styles.optionDescription}>{option.description}</p>
                      ) : (
                        <p className={styles.optionDescriptionMuted}>Sem descrição cadastrada.</p>
                      )}

                      {service ? (
                        <dl className={styles.meta} aria-label="Faixa de preço e duração estimada">
                          <div>
                            <dt>Valor</dt>
                            <dd>{formatPrice(service.price)}</dd>
                          </div>
                          <div>
                            <dt>Duração</dt>
                            <dd>{formatDuration(service.duration)}</dd>
                          </div>
                          <div>
                            <dt>Sinal</dt>
                            <dd>{formatPrice(service.deposit)}</dd>
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
