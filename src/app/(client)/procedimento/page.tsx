'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

import { supabase } from '@/lib/db'
import {
  DEFAULT_FALLBACK_BUFFER_MINUTES,
  DEFAULT_SLOT_TEMPLATE,
  DEFAULT_TIMEZONE,
  buildAvailabilityData,
  formatDateToIsoDay,
  type AvailabilityAppointment,
} from '@/lib/availability'
import { stripePromise } from '@/lib/stripeClient'
import ClientMenu from '@/components/ClientMenu'
import { useLavaLamp } from '@/components/LavaLampProvider'
import { REVEAL_STAGE, useLavaRevealStage } from '@/lib/useLavaRevealStage'

type ServiceTechnique = {
  id: string
  name: string
  slug: string | null
  duration_min: number
  price_cents: number
  deposit_cents: number
  buffer_min: number | null
  active: boolean
}

type ServiceTypeAssignment = {
  services?: ServiceTechnique | ServiceTechnique[] | null
}

type TechniqueCatalogEntry = {
  id: string
  name: string
  slug: string | null
  description: string | null
  order_index: number
  active: boolean
  services: ServiceTechnique[]
}

type TechniqueSummary = {
  id: string
  name: string
  slug: string | null
  description: string | null
  order_index: number
}

type ServiceOption = ServiceTechnique & {
  techniques: TechniqueSummary[]
}

type LoadedAppointment = Parameters<typeof buildAvailabilityData>[0][number]

type SummarySnapshot = {
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
function escapeRegExp(value: string): string {
  return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}

function isHex(value: string): boolean {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value.trim())
}

type Rgb = { r: number; g: number; b: number }

function hexToRgb(hex: string): Rgb {
  const raw = hex.replace('#', '')
  const normalized = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw
  const value = parseInt(normalized, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgbaFromHexAlpha(hex: string, alpha: string | number): string {
  const { r, g, b } = hexToRgb(hex)
  const parsed = typeof alpha === 'number' ? alpha : parseFloat(alpha)
  const clamped = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0
  return `rgba(${r}, ${g}, ${b}, ${clamped})`
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min'
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (remaining > 0) parts.push(`${remaining} min`)
  return parts.join(' ')
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function combineDateAndTime(dateIso: string, time: string, timeZone = DEFAULT_TIMEZONE) {
  const [hour, minute] = time.split(':')

  if (!dateIso || typeof hour === 'undefined' || typeof minute === 'undefined') {
    return null
  }

  const normalizedHour = hour.padStart(2, '0')
  const normalizedMinute = minute.padStart(2, '0')
  const candidate = fromZonedTime(`${dateIso}T${normalizedHour}:${normalizedMinute}:00`, timeZone)

  if (Number.isNaN(candidate.getTime())) {
    return null
  }

  return candidate
}

function LashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 12c3-4 15-4 18 0" />
      <path d="M7 13.5 6 16" />
      <path d="M10 14l-.6 2" />
      <path d="M13.5 14l.6 2" />
      <path d="M17 13.5l1 2" />
    </svg>
  )
}

const FALLBACK_BUFFER_MINUTES = DEFAULT_FALLBACK_BUFFER_MINUTES
const WORK_DAY_END = '18:00'

export default function ProcedimentoPage() {
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [techniqueCatalog, setTechniqueCatalog] = useState<TechniqueCatalogEntry[]>([])
  const [catalogStatus, setCatalogStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string | null>(null)
  const [showAllTechniques, setShowAllTechniques] = useState(false)
  const [appointments, setAppointments] = useState<LoadedAppointment[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [summarySnapshot, setSummarySnapshot] = useState<SummarySnapshot | null>(null)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [isPayLaterNoticeOpen, setIsPayLaterNoticeOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState<
    { kind: 'success' | 'error'; text: string } | null
  >(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false)
  const [pendingScrollTarget, setPendingScrollTarget] = useState<
    'technique' | 'date' | 'time' | null
  >(null)

  const router = useRouter()
  const { refreshPalette } = useLavaLamp()
  const revealStage = useLavaRevealStage()

  const typeSectionRef = useRef<HTMLDivElement | null>(null)
  const techniqueSectionRef = useRef<HTMLDivElement | null>(null)
  const dateSectionRef = useRef<HTMLDivElement | null>(null)
  const timeSectionRef = useRef<HTMLDivElement | null>(null)
  const slotsContainerRef = useRef<HTMLDivElement | null>(null)
  const summaryRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      setShouldReduceMotion(prefersReducedMotion())
      return
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncPreference = () => setShouldReduceMotion(media.matches)

    syncPreference()

    media.addEventListener('change', syncPreference)
    return () => {
      media.removeEventListener('change', syncPreference)
    }
  }, [])

  useEffect(() => {
    const updatedVars = new Set<string>()
    const cleanupFns: Array<() => void> = []

    const styleNode = document.getElementById('procedimento-style') as HTMLStyleElement | null

    const commitVar = (name: string, value: string) => {
      document.documentElement.style.setProperty(name, value)
      updatedVars.add(name)

      if (!styleNode || !styleNode.textContent) return

      const pattern = new RegExp(`(${escapeRegExp(name)}\\s*:\\s*)([^;]*)(;)`)
      styleNode.textContent = styleNode.textContent.replace(pattern, `$1${value}$3`)
    }

    const glassColorEl = document.getElementById('glassColor') as HTMLInputElement | null
    const glassAlphaEl = document.getElementById('glassAlpha') as HTMLInputElement | null
    const glassHexEl = document.getElementById('glassHex') as HTMLInputElement | null
    const applyGlassHex = document.getElementById('applyGlassHex') as HTMLButtonElement | null

    const cardTop = document.getElementById('cardTop') as HTMLInputElement | null
    const cardBottom = document.getElementById('cardBottom') as HTMLInputElement | null
    const cardTopHex = document.getElementById('cardTopHex') as HTMLInputElement | null
    const cardBottomHex = document.getElementById('cardBottomHex') as HTMLInputElement | null
    const addCardTop = document.getElementById('addCardTop') as HTMLButtonElement | null
    const addCardBottom = document.getElementById('addCardBottom') as HTMLButtonElement | null

    const cardBorderColor = document.getElementById('cardBorderColor') as HTMLInputElement | null
    const cardBorderAlpha = document.getElementById('cardBorderAlpha') as HTMLInputElement | null
    const cardBorderHex = document.getElementById('cardBorderHex') as HTMLInputElement | null
    const applyCardBorderHex = document.getElementById('applyCardBorderHex') as HTMLButtonElement | null

    const bgTop = document.getElementById('bgTop') as HTMLInputElement | null
    const bgBottom = document.getElementById('bgBottom') as HTMLInputElement | null
    const bgTopHex = document.getElementById('bgTopHex') as HTMLInputElement | null
    const bgBottomHex = document.getElementById('bgBottomHex') as HTMLInputElement | null
    const addBgTop = document.getElementById('addBgTop') as HTMLButtonElement | null
    const addBgBottom = document.getElementById('addBgBottom') as HTMLButtonElement | null

    const glassBorderColor = document.getElementById('glassBorderColor') as HTMLInputElement | null
    const glassBorderAlpha = document.getElementById('glassBorderAlpha') as HTMLInputElement | null
    const glassBorderHex = document.getElementById('glassBorderHex') as HTMLInputElement | null
    const applyGlassBorderHex = document.getElementById('applyGlassBorderHex') as HTMLButtonElement | null

    const bubbleDark = document.getElementById('bubbleDark') as HTMLInputElement | null
    const bubbleLight = document.getElementById('bubbleLight') as HTMLInputElement | null
    const bubbleAlphaMin = document.getElementById('bubbleAlphaMin') as HTMLInputElement | null
    const bubbleAlphaMax = document.getElementById('bubbleAlphaMax') as HTMLInputElement | null
    const bubbleDarkHex = document.getElementById('bubbleDarkHex') as HTMLInputElement | null
    const bubbleLightHex = document.getElementById('bubbleLightHex') as HTMLInputElement | null
    const applyBubbleDark = document.getElementById('applyBubbleDark') as HTMLButtonElement | null
    const applyBubbleLight = document.getElementById('applyBubbleLight') as HTMLButtonElement | null

    const textInk = document.getElementById('textInk') as HTMLInputElement | null
    const textMuted = document.getElementById('textMuted') as HTMLInputElement | null
    const textMuted2 = document.getElementById('textMuted2') as HTMLInputElement | null
    const textInkHex = document.getElementById('textInkHex') as HTMLInputElement | null
    const textMutedHex = document.getElementById('textMutedHex') as HTMLInputElement | null
    const textMuted2Hex = document.getElementById('textMuted2Hex') as HTMLInputElement | null
    const applyTextInk = document.getElementById('applyTextInk') as HTMLButtonElement | null
    const applyTextMuted = document.getElementById('applyTextMuted') as HTMLButtonElement | null
    const applyTextMuted2 = document.getElementById('applyTextMuted2') as HTMLButtonElement | null

    const fontBody = document.getElementById('fontBody') as HTMLSelectElement | null
    const fontHeading = document.getElementById('fontHeading') as HTMLSelectElement | null

    const sizeBase = document.getElementById('sizeBase') as HTMLInputElement | null
    const sizeH1 = document.getElementById('sizeH1') as HTMLInputElement | null
    const sizeCard = document.getElementById('sizeCard') as HTMLInputElement | null
    const sizeLabel = document.getElementById('sizeLabel') as HTMLInputElement | null

    const paletteBtn = isAdmin
      ? (document.getElementById('paletteBtn') as HTMLButtonElement | null)
      : null
    const palettePanel = isAdmin
      ? (document.getElementById('palettePanel') as HTMLDivElement | null)
      : null
    const saveBtn = isAdmin
      ? (document.getElementById('saveBtn') as HTMLButtonElement | null)
      : null

    const syncLavaPaletteFromVars = () => {
      refreshPalette()
    }

    function syncGlassVar() {
      if (!glassColorEl || !glassAlphaEl) return
      commitVar('--glass', rgbaFromHexAlpha(glassColorEl.value, glassAlphaEl.value))
    }

    function syncGlassPickersFromVar() {
      if (!glassColorEl || !glassAlphaEl) return
      const value = getComputedStyle(document.documentElement).getPropertyValue('--glass').trim()
      const match = value.match(/rgba?\(([^)]+)\)/i)
      if (!match) return
      const parts = match[1].split(',').map((part) => part.trim())
      const [r, g, b, a = '1'] = parts
      const toHex = (component: string) => {
        const parsed = Math.max(0, Math.min(255, Number(component)))
        return parsed.toString(16).padStart(2, '0')
      }
      glassColorEl.value = `#${[r, g, b].map(toHex).join('')}`
      glassAlphaEl.value = String(Number(a))
    }

    function syncCardBorder() {
      if (!cardBorderColor || !cardBorderAlpha) return
      const fallback = cardBorderColor.value
      const hexValue = (cardBorderHex?.value ?? '').trim()
      const base = hexValue && isHex(hexValue) ? hexValue : fallback
      commitVar('--card-stroke', rgbaFromHexAlpha(base, cardBorderAlpha.value))
    }

    function syncGlassBorder() {
      if (!glassBorderColor || !glassBorderAlpha) return
      const fallback = glassBorderColor.value
      const hexValue = (glassBorderHex?.value ?? '').trim()
      const base = hexValue && isHex(hexValue) ? hexValue : fallback
      commitVar('--glass-stroke', rgbaFromHexAlpha(base, glassBorderAlpha.value))
    }


    function handleSwatchClick(this: HTMLElement) {
      const rules = this.dataset.css?.split(';').map((rule) => rule.trim()).filter(Boolean) ?? []
      for (const rule of rules) {
        const [prop, val] = rule.split(':')
        if (!prop || typeof val === 'undefined') continue
        commitVar(prop.trim(), val.trim())
      }
      if (rules.some((rule) => rule.includes('--dark') || rule.includes('--light'))) {
        syncLavaPaletteFromVars()
      }
      if (rules.some((rule) => rule.includes('--glass'))) {
        syncGlassPickersFromVar()
      }
    }

    document.querySelectorAll<HTMLElement>('#palettePanel .swatch').forEach((swatch) => {
      swatch.addEventListener('click', handleSwatchClick)
      cleanupFns.push(() => swatch.removeEventListener('click', handleSwatchClick))
    })

    cardTop?.addEventListener('input', (event) => {
      const value = (event.target as HTMLInputElement).value
      commitVar('--inner-top', value)
    })
    cardBottom?.addEventListener('input', (event) => {
      const value = (event.target as HTMLInputElement).value
      commitVar('--inner-bottom', value)
    })
    addCardTop?.addEventListener('click', () => {
      const value = cardTopHex?.value.trim()
      if (value && isHex(value)) {
        commitVar('--inner-top', value)
        if (cardTop) cardTop.value = value
      }
    })
    addCardBottom?.addEventListener('click', () => {
      const value = cardBottomHex?.value.trim()
      if (value && isHex(value)) {
        commitVar('--inner-bottom', value)
        if (cardBottom) cardBottom.value = value
      }
    })

    cardBorderColor?.addEventListener('input', syncCardBorder)
    cardBorderAlpha?.addEventListener('input', syncCardBorder)
    applyCardBorderHex?.addEventListener('click', () => {
      if (cardBorderHex && isHex(cardBorderHex.value.trim())) {
        syncCardBorder()
      }
    })

    bgTop?.addEventListener('input', (event) => {
      const value = (event.target as HTMLInputElement).value
      commitVar('--bg-top', value)
    })
    bgBottom?.addEventListener('input', (event) => {
      const value = (event.target as HTMLInputElement).value
      commitVar('--bg-bottom', value)
    })
    addBgTop?.addEventListener('click', () => {
      const value = bgTopHex?.value.trim()
      if (value && isHex(value)) {
        commitVar('--bg-top', value)
        if (bgTop) bgTop.value = value
      }
    })
    addBgBottom?.addEventListener('click', () => {
      const value = bgBottomHex?.value.trim()
      if (value && isHex(value)) {
        commitVar('--bg-bottom', value)
        if (bgBottom) bgBottom.value = value
      }
    })

    glassBorderColor?.addEventListener('input', syncGlassBorder)
    glassBorderAlpha?.addEventListener('input', syncGlassBorder)
    applyGlassBorderHex?.addEventListener('click', () => {
      if (glassBorderHex && isHex(glassBorderHex.value.trim())) {
        syncGlassBorder()
      }
    })

    glassColorEl?.addEventListener('input', syncGlassVar)
    glassAlphaEl?.addEventListener('input', syncGlassVar)
    applyGlassHex?.addEventListener('click', () => {
      const value = glassHexEl?.value.trim()
      if (value && isHex(value) && glassColorEl) {
        glassColorEl.value = value
        syncGlassVar()
      }
    })

    bubbleDark?.addEventListener('input', (event) => {
      const value = (event.target as HTMLInputElement).value
      commitVar('--dark', value)
      syncLavaPaletteFromVars()
    })
    bubbleLight?.addEventListener('input', (event) => {
      const value = (event.target as HTMLInputElement).value
      commitVar('--light', value)
      syncLavaPaletteFromVars()
    })
    applyBubbleDark?.addEventListener('click', () => {
      const value = bubbleDarkHex?.value.trim()
      if (value && isHex(value)) {
        commitVar('--dark', value)
        if (bubbleDark) bubbleDark.value = value
        syncLavaPaletteFromVars()
      }
    })
    applyBubbleLight?.addEventListener('click', () => {
      const value = bubbleLightHex?.value.trim()
      if (value && isHex(value)) {
        commitVar('--light', value)
        if (bubbleLight) bubbleLight.value = value
        syncLavaPaletteFromVars()
      }
    })
    const handleBubbleAlpha = () => {
      if (!bubbleAlphaMin || !bubbleAlphaMax) return
      let min = parseFloat(bubbleAlphaMin.value)
      let max = parseFloat(bubbleAlphaMax.value)
      if (Number.isNaN(min)) min = 0
      if (Number.isNaN(max)) max = 1
      if (max < min) {
        ;[min, max] = [max, min]
        bubbleAlphaMin.value = String(min)
        bubbleAlphaMax.value = String(max)
      }
      commitVar('--lava-alpha-min', String(min))
      commitVar('--lava-alpha-max', String(max))
      refreshPalette()
    }
    bubbleAlphaMin?.addEventListener('input', handleBubbleAlpha)
    bubbleAlphaMax?.addEventListener('input', handleBubbleAlpha)

    textInk?.addEventListener('input', (event) => {
      commitVar('--ink', (event.target as HTMLInputElement).value)
    })
    textMuted?.addEventListener('input', (event) => {
      commitVar('--muted', (event.target as HTMLInputElement).value)
    })
    textMuted2?.addEventListener('input', (event) => {
      commitVar('--muted-2', (event.target as HTMLInputElement).value)
    })
    applyTextInk?.addEventListener('click', () => {
      const value = textInkHex?.value.trim()
      if (value && isHex(value)) {
        commitVar('--ink', value)
        if (textInk) textInk.value = value
      }
    })
    applyTextMuted?.addEventListener('click', () => {
      const value = textMutedHex?.value.trim()
      if (value && isHex(value)) {
        commitVar('--muted', value)
        if (textMuted) textMuted.value = value
      }
    })
    applyTextMuted2?.addEventListener('click', () => {
      const value = textMuted2Hex?.value.trim()
      if (value && isHex(value)) {
        commitVar('--muted-2', value)
        if (textMuted2) textMuted2.value = value
      }
    })

    fontBody?.addEventListener('change', (event) => {
      commitVar('--font-family', (event.target as HTMLSelectElement).value)
    })
    fontHeading?.addEventListener('change', (event) => {
      commitVar('--heading-font', (event.target as HTMLSelectElement).value)
    })

    const initSizes = () => {
      const h1 = document.querySelector<HTMLHeadingElement>('h1')
      const cardSpan = document.querySelector<HTMLSpanElement>('.card span')
      const label = document.querySelector<HTMLDivElement>('.label')
      if (sizeH1 && h1) sizeH1.value = Math.round(parseFloat(getComputedStyle(h1).fontSize)).toString()
      if (sizeCard && cardSpan)
        sizeCard.value = Math.round(parseFloat(getComputedStyle(cardSpan).fontSize)).toString()
      if (sizeLabel && label)
        sizeLabel.value = Math.round(parseFloat(getComputedStyle(label).fontSize)).toString()
      if (sizeBase)
        sizeBase.value = Math.round(parseFloat(getComputedStyle(document.body).fontSize)).toString()
    }
    initSizes()

    sizeBase?.addEventListener('input', (event) => {
      const value = parseInt((event.target as HTMLInputElement).value || '16', 10)
      commitVar('--base-font-size', `${Number.isNaN(value) ? 16 : value}px`)
    })
    sizeH1?.addEventListener('input', (event) => {
      const value = parseInt((event.target as HTMLInputElement).value || '28', 10)
      if (!Number.isNaN(value)) commitVar('--heading-size', `${value}px`)
    })
    sizeCard?.addEventListener('input', (event) => {
      const value = parseInt((event.target as HTMLInputElement).value || '20', 10)
      if (!Number.isNaN(value)) commitVar('--card-text-size', `${value}px`)
    })
    sizeLabel?.addEventListener('input', (event) => {
      const value = parseInt((event.target as HTMLInputElement).value || '11', 10)
      if (!Number.isNaN(value)) commitVar('--label-size', `${value}px`)
    })

    if (paletteBtn) {
      const handlePaletteToggle = () => {
        palettePanel?.classList.toggle('open')
      }
      paletteBtn.addEventListener('click', handlePaletteToggle)
      cleanupFns.push(() => paletteBtn.removeEventListener('click', handlePaletteToggle))
    }

    if (palettePanel) {
      const handlePanelClick = (event: MouseEvent) => {
        if (event.target === palettePanel) {
          palettePanel.classList.remove('open')
        }
      }
      palettePanel.addEventListener('click', handlePanelClick)
      cleanupFns.push(() => palettePanel.removeEventListener('click', handlePanelClick))
    }

    const fontUrl = document.getElementById('fontUrl') as HTMLInputElement | null
    const fontFamilyName = document.getElementById('fontFamilyName') as HTMLInputElement | null
    const fontApplyWhere = document.getElementById('fontApplyWhere') as HTMLSelectElement | null
    const addFontBtn = document.getElementById('addFontBtn') as HTMLButtonElement | null

    function injectFontLink(url: string) {
      const existing = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).some(
        (link) => link.href === url,
      )
      if (existing) return
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url
      document.head.appendChild(link)
    }

    function addOptionIfMissing(select: HTMLSelectElement, family: string) {
      if (Array.from(select.options).some((option) => option.value === family)) return
      const option = document.createElement('option')
      option.value = family
      option.textContent = family.split(',')[0]?.replace(/['"]/g, '') ?? family
      select.appendChild(option)
    }

    addFontBtn?.addEventListener('click', () => {
      const url = fontUrl?.value.trim()
      const family = fontFamilyName?.value.trim()
      const target = fontApplyWhere?.value ?? 'body'
      if (!url || !family) return
      injectFontLink(url)
      if ((target === 'body' || target === 'both') && fontBody) {
        addOptionIfMissing(fontBody, family)
        commitVar('--font-family', family)
        fontBody.value = family
      }
      if ((target === 'heading' || target === 'both') && fontHeading) {
        addOptionIfMissing(fontHeading, family)
        commitVar('--heading-font', family)
        fontHeading.value = family
      }
    })

    if (saveBtn) {
      const handleSaveClick = () => {
        const html = '<!doctype html>\n' + document.documentElement.outerHTML
        const blob = new Blob([html], { type: 'text/html' })
        const anchor = document.createElement('a')
        const name = (document.title || 'index').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.html'
        anchor.href = URL.createObjectURL(blob)
        anchor.download = name
        document.body.appendChild(anchor)
        anchor.click()
        window.setTimeout(() => {
          URL.revokeObjectURL(anchor.href)
          anchor.remove()
        }, 1200)
      }
      saveBtn.addEventListener('click', handleSaveClick)
      cleanupFns.push(() => saveBtn.removeEventListener('click', handleSaveClick))
    }

    function lockGlassHeight() {
      window.requestAnimationFrame(() => {
        const reference = document.querySelector<HTMLElement>('#sectionTipo .glass')
        if (!reference) return
        const height = reference.getBoundingClientRect().height
        if (height > 0) {
          commitVar('--glass-min-height', `${Math.round(height)}px`)
        }
      })
    }

    lockGlassHeight()

    const resizeHandler = () => lockGlassHeight()
    window.addEventListener('resize', resizeHandler)
    cleanupFns.push(() => window.removeEventListener('resize', resizeHandler))

    document.documentElement.classList.add('force-motion')
    if (window.location.hash.includes('nomotion')) {
      document.documentElement.classList.remove('force-motion')
    }

    syncGlassPickersFromVar()
    syncCardBorder()
    syncGlassBorder()
    syncLavaPaletteFromVars()
    syncGlassVar()
    handleBubbleAlpha()

    return () => {
      document.documentElement.classList.remove('force-motion')
      updatedVars.forEach((name) => {
        document.documentElement.style.removeProperty(name)
      })
      cleanupFns.forEach((fn) => fn())
    }
  }, [isAdmin, refreshPalette])

  useEffect(() => {
    let active = true

    const loadSessionAndProfile = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return

      if (error) {
        console.error('Erro ao obter sessão', error)
        setUserId(null)
        setIsAdmin(false)
        return
      }

      const session = data.session
      if (!session) {
        window.location.href = '/login'
        return
      }

      setUserId(session.user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!active) return

      if (profileError) {
        console.error('Erro ao carregar perfil', profileError)
        setIsAdmin(false)
        return
      }

      const role = profile?.role
      const isAdminRole = role === 'admin' || role === 'adminsuper' || role === 'adminmaster'
      setIsAdmin(isAdminRole)
    }

    void loadSessionAndProfile()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      setCatalogStatus('loading')
      setCatalogError(null)

      try {
        const { data, error } = await supabase
          .from('service_types')
          .select(
            `id, name, slug, description, active, order_index, assignments:service_type_assignments(services:services(id, name, slug, duration_min, price_cents, deposit_cents, buffer_min, active))`,
          )
          .eq('active', true)
          .order('order_index', { ascending: true, nullsFirst: true })
          .order('name', { ascending: true })

        if (error) throw error
        if (!active) return

        const normalized = (data ?? []).map((entry) => {
          const assignments = Array.isArray(entry.assignments)
            ? entry.assignments
            : entry.assignments
            ? [entry.assignments]
            : []

          const seenServices = new Set<string>()
          const servicesRaw = assignments.flatMap((assignment: ServiceTypeAssignment) => {
            const related = assignment?.services
            const relatedArray = Array.isArray(related)
              ? related
              : related
              ? [related]
              : []

            return relatedArray.filter((svc): svc is ServiceTechnique => {
              if (!svc || typeof svc.id !== 'string') return false
              if (seenServices.has(svc.id)) return false
              seenServices.add(svc.id)
              return true
            })
          })

          const services = servicesRaw
            .filter((svc) => svc && svc.active !== false)
            .map((svc) => {
              const duration = normalizeNumber(svc?.duration_min) ?? 0
              const price = normalizeNumber(svc?.price_cents) ?? 0
              const deposit = normalizeNumber(svc?.deposit_cents) ?? 0
              const buffer = normalizeNumber(svc?.buffer_min)

              return {
                id: svc.id,
                name: svc.name ?? 'Serviço',
                slug: svc.slug ?? null,
                duration_min: Math.max(0, Math.round(duration)),
                price_cents: Math.max(0, Math.round(price)),
                deposit_cents: Math.max(0, Math.round(deposit)),
                buffer_min: buffer !== null ? Math.max(0, Math.round(buffer)) : null,
                active: svc.active !== false,
              }
            })
            .filter((svc) => svc.duration_min > 0)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

          const orderIndex = normalizeNumber(entry.order_index)

          return {
            id: entry.id,
            name: entry.name ?? 'Serviço',
            slug: entry.slug ?? null,
            description: entry.description ?? null,
            order_index: orderIndex !== null ? Math.round(orderIndex) : 0,
            active: entry.active !== false,
            services,
          } satisfies TechniqueCatalogEntry
        })

        normalized.sort(
          (a, b) =>
            a.order_index - b.order_index || a.name.localeCompare(b.name, 'pt-BR'),
        )

        setTechniqueCatalog(normalized)
        setCatalogStatus('ready')
      } catch (error) {
        console.error('Erro ao carregar serviços', error)
        if (!active) return
        setTechniqueCatalog([])
        setCatalogStatus('error')
        setCatalogError('Não foi possível carregar os serviços disponíveis. Tente novamente mais tarde.')
      }
    }

    void loadCatalog()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    let isMounted = true

    const relevantStatuses = new Set(['pending', 'reserved', 'confirmed'])

    type AppointmentRecord = Partial<AvailabilityAppointment> | null | undefined

    const isRecordRelevant = (record: AppointmentRecord) => {
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

    const loadAvailability = async (options: { withLoading?: boolean } = {}) => {
      const { withLoading = true } = options

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

        if (!isMounted) return

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const limit = new Date(today)
        limit.setDate(limit.getDate() + 60)

        const { data, error } = await supabase
          .from('appointments')
          .select('id, scheduled_at, starts_at, ends_at, status, customer_id, services(buffer_min)')
          .gte('starts_at', today.toISOString())
          .lte('starts_at', limit.toISOString())
          .in('status', ['pending', 'reserved', 'confirmed'])
          .order('starts_at', { ascending: true })

        if (error) throw error
        if (!isMounted) return

        setAppointments(data ?? [])
        setAvailabilityError(null)
      } catch (err) {
        console.error('Erro ao carregar disponibilidade', err)
        if (isMounted) {
          setAvailabilityError('Não foi possível carregar a disponibilidade. Tente novamente mais tarde.')
          setAppointments([])
        }
      } finally {
        if (withLoading && isMounted) {
          setIsLoadingAvailability(false)
        }
      }
    }

    void loadAvailability({ withLoading: true })

    const channel = supabase
      .channel('procedimento-appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          if (!isMounted) return

          const { new: newRecord, old: oldRecord } = payload

          if (isRecordRelevant(newRecord as AppointmentRecord) || isRecordRelevant(oldRecord as AppointmentRecord)) {
            void loadAvailability({ withLoading: false })
          }
        },
      )
      .subscribe()

    return () => {
      isMounted = false
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const techniqueMap = useMemo(() => {
    const map = new Map<string, TechniqueCatalogEntry>()
    techniqueCatalog.forEach((technique) => {
      map.set(technique.id, technique)
    })
    return map
  }, [techniqueCatalog])

  const serviceOptions = useMemo<ServiceOption[]>(() => {
    const grouped = new Map<
      string,
      { service: ServiceTechnique; techniques: Map<string, TechniqueSummary> }
    >()

    techniqueCatalog.forEach((technique) => {
      const techniqueSummary: TechniqueSummary = {
        id: technique.id,
        name: technique.name,
        slug: technique.slug,
        description: technique.description,
        order_index: technique.order_index,
      }

      technique.services.forEach((service) => {
        const existing = grouped.get(service.id)
        if (!existing) {
          grouped.set(service.id, {
            service,
            techniques: new Map([[techniqueSummary.id, techniqueSummary]]),
          })
          return
        }

        if (!existing.techniques.has(techniqueSummary.id)) {
          existing.techniques.set(techniqueSummary.id, techniqueSummary)
        }
      })
    })

    return Array.from(grouped.values())
      .map(({ service, techniques }) => ({
        ...service,
        techniques: Array.from(techniques.values()).sort((a, b) => {
          const orderDiff = a.order_index - b.order_index
          if (orderDiff !== 0) return orderDiff
          return a.name.localeCompare(b.name, 'pt-BR')
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [techniqueCatalog])

  const availableServices = useMemo(
    () => serviceOptions.filter((service) => service.techniques.length > 0),
    [serviceOptions],
  )

  useEffect(() => {
    if (catalogStatus !== 'ready') return

    if (availableServices.length === 0) {
      setSelectedServiceId(null)
      return
    }

    if (selectedServiceId && !availableServices.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(null)
    }
  }, [availableServices, catalogStatus, selectedServiceId])

  const selectedService = useMemo(
    () => availableServices.find((service) => service.id === selectedServiceId) ?? null,
    [availableServices, selectedServiceId],
  )

  const visibleTechniques = useMemo(() => {
    if (!selectedService) return []
    if (showAllTechniques) return selectedService.techniques
    return selectedService.techniques.slice(0, 6)
  }, [selectedService, showAllTechniques])

  useEffect(() => {
    setShowAllTechniques(false)
  }, [selectedServiceId])

  useEffect(() => {
    if (!selectedService) {
      if (selectedTechniqueId !== null) {
        setSelectedTechniqueId(null)
      }
      return
    }

    const activeTechniques = selectedService.techniques
    if (activeTechniques.length === 0) {
      if (selectedTechniqueId !== null) {
        setSelectedTechniqueId(null)
      }
      return
    }

    if (selectedTechniqueId && !activeTechniques.some((tech) => tech.id === selectedTechniqueId)) {
      setSelectedTechniqueId(null)
    }
  }, [selectedService, selectedTechniqueId])

  const selectedTechnique = useMemo(() => {
    if (!selectedTechniqueId) return null

    const withinService = selectedService?.techniques.find((tech) => tech.id === selectedTechniqueId)
    if (withinService) return withinService

    const fallback = techniqueMap.get(selectedTechniqueId)
    if (!fallback) return null

    return {
      id: fallback.id,
      name: fallback.name,
      slug: fallback.slug,
      description: fallback.description,
      order_index: fallback.order_index,
    }
  }, [selectedService, selectedTechniqueId, techniqueMap])

  useEffect(() => {
    setSelectedSlot(null)
  }, [selectedTechniqueId])

  const availability = useMemo(
    () =>
      buildAvailabilityData(appointments, userId, {
        fallbackBufferMinutes: FALLBACK_BUFFER_MINUTES,
        timezone: DEFAULT_TIMEZONE,
      }),
    [appointments, userId],
  )

  const monthTitle = useMemo(() => {
    const localeTitle = new Date(year, month, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
    return localeTitle.charAt(0).toUpperCase() + localeTitle.slice(1)
  }, [month, year])

  const serviceBufferMinutes = useMemo(() => {
    const normalized = normalizeNumber(selectedService?.buffer_min)
    const fallback = FALLBACK_BUFFER_MINUTES
    if (normalized === null) return Math.max(0, fallback)
    return Math.max(0, Math.round(normalized))
  }, [selectedService])

  const canInteract =
    catalogStatus === 'ready' &&
    !!selectedService &&
    !!selectedTechnique &&
    !isLoadingAvailability &&
    !availabilityError

  const calendarHeaderDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startWeekday = firstDay.getDay()
    const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

    return Array.from({ length: 7 }, (_, index) => labels[(startWeekday + index) % 7])
  }, [month, year])

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dayEntries: Array<{
      iso: string
      day: string
      isDisabled: boolean
      state: string
      isOutsideCurrentMonth: boolean
    }> = []

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day)
      const iso = formatDateToIsoDay(date, DEFAULT_TIMEZONE)

      let status: 'available' | 'booked' | 'full' | 'mine' | 'disabled' = 'disabled'
      if (availability.myDays.has(iso)) status = 'mine'
      else if (availability.bookedDays.has(iso)) status = 'full'
      else if (availability.partiallyBookedDays.has(iso)) status = 'booked'
      else if (availability.availableDays.has(iso)) status = 'available'

      const isPast = date < today
      const isDisabled =
        !canInteract ||
        isPast ||
        status === 'full' ||
        status === 'disabled'

      dayEntries.push({
        iso,
        day: String(day),
        isDisabled,
        state: status,
        isOutsideCurrentMonth: false,
      })
    }

    const trailingSpacers = (7 - (dayEntries.length % 7)) % 7
    for (let day = 1; day <= trailingSpacers; day += 1) {
      dayEntries.push({
        iso: `trailing-${year}-${month}-${day}`,
        day: '',
        isDisabled: true,
        state: 'disabled',
        isOutsideCurrentMonth: true,
      })
    }

    return { dayEntries }
  }, [
    availability.availableDays,
    availability.bookedDays,
    availability.partiallyBookedDays,
    availability.myDays,
    canInteract,
    month,
    year,
  ])

  const busyIntervalsForSelectedDate = useMemo(() => {
    if (!selectedDate) return []

    const raw = availability.busyIntervals[selectedDate] ?? []

    return raw
      .map(({ start, end }) => {
        const busyStart = new Date(start)
        const busyEnd = new Date(end)
        if (Number.isNaN(busyStart.getTime()) || Number.isNaN(busyEnd.getTime())) {
          return null
        }
        return { start: busyStart, end: busyEnd }
      })
      .filter((interval): interval is { start: Date; end: Date } => interval !== null)
  }, [availability.busyIntervals, selectedDate])

  const bookedSlots = useMemo(() => {
    if (!selectedDate) return new Set<string>()
    return new Set(availability.bookedSlots[selectedDate] ?? [])
  }, [availability.bookedSlots, selectedDate])

  const slots = useMemo(() => {
    if (!selectedDate || !canInteract || !selectedService) return []

    const durationMinutes = selectedService.duration_min
    if (!durationMinutes) return []

    const template = availability.daySlots[selectedDate] ?? DEFAULT_SLOT_TEMPLATE

    const closing = combineDateAndTime(selectedDate, WORK_DAY_END)
    if (!closing) return []

    const todayIso = formatInTimeZone(now, DEFAULT_TIMEZONE, 'yyyy-MM-dd')

    return template.filter((slotValue) => {
      const slotStart = combineDateAndTime(selectedDate, slotValue)
      if (!slotStart) return false

      if (selectedDate === todayIso && slotStart <= now) {
        return false
      }

      const slotEnd = new Date(slotStart.getTime() + (durationMinutes + serviceBufferMinutes) * 60000)
      if (slotEnd > closing) {
        return false
      }

      const overlaps = busyIntervalsForSelectedDate.some(({ start, end }) => slotEnd > start && slotStart < end)

      return !overlaps
    })
  }, [
    availability.daySlots,
    busyIntervalsForSelectedDate,
    canInteract,
    now,
    selectedDate,
    selectedService,
    serviceBufferMinutes,
  ])

  useEffect(() => {
    if (!selectedSlot) return
    if (!slots.includes(selectedSlot)) {
      setSelectedSlot(null)
    }
  }, [selectedSlot, slots])

  const goToPreviousMonth = useCallback(() => {
    const previous = new Date(year, month - 1, 1)
    setYear(previous.getFullYear())
    setMonth(previous.getMonth())
  }, [month, year])

  const goToNextMonth = useCallback(() => {
    const next = new Date(year, month + 1, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }, [month, year])

  const handleServiceSelect = useCallback(
    (serviceId: string) => {
      if (serviceId === selectedServiceId) return
      setSelectedServiceId(serviceId)
      setSelectedTechniqueId(null)
      setSelectedDate(null)
      setSelectedSlot(null)
      setPendingScrollTarget('technique')
    },
    [selectedServiceId],
  )

  const handleTechniqueSelect = useCallback((techniqueId: string) => {
    if (techniqueId === selectedTechniqueId) return
    setSelectedTechniqueId(techniqueId)
    setSelectedDate(null)
    setSelectedSlot(null)
    setPendingScrollTarget('date')
  }, [selectedTechniqueId])

  const handleDaySelect = useCallback(
    (dayIso: string, disabled: boolean) => {
      if (disabled || !canInteract) return
      setSelectedDate(dayIso)
      setSelectedSlot(null)
      setPendingScrollTarget('time')
    },
    [canInteract],
  )

  const handleSlotSelect = useCallback(
    (slotValue: string, disabled: boolean) => {
      if (disabled) return
      setSelectedSlot(slotValue)
    },
    [],
  )

  useEffect(() => {
    if (!pendingScrollTarget) return

    const behavior = shouldReduceMotion ? 'auto' : 'smooth'
    let element: HTMLElement | null = null

    if (pendingScrollTarget === 'technique') {
      element = techniqueSectionRef.current
    } else if (pendingScrollTarget === 'date') {
      element = dateSectionRef.current
    } else if (pendingScrollTarget === 'time') {
      element = timeSectionRef.current
    }

    if (element) {
      element.scrollIntoView({ behavior, block: 'start' })
    }

    setPendingScrollTarget(null)
  }, [pendingScrollTarget, shouldReduceMotion])

  const summaryData = useMemo(() => {
    if (!selectedService || !selectedTechnique || !selectedDate || !selectedSlot) return null

    const priceValue = Number.isFinite(selectedService.price_cents)
      ? selectedService.price_cents / 100
      : 0
    const priceLabel = priceValue > 0
      ? priceValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'R$ 0,00'

    const depositCents = Number.isFinite(selectedService.deposit_cents)
      ? Math.max(0, selectedService.deposit_cents)
      : 0
    const depositLabel = depositCents > 0
      ? (depositCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'Sem sinal'

    const dateLabel = new Date(selectedDate).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    return {
      typeId: selectedService.id,
      typeName: selectedService.name,
      techniqueId: selectedTechnique.id,
      techniqueName: selectedTechnique.name,
      priceLabel,
      priceCents: Number.isFinite(selectedService.price_cents)
        ? selectedService.price_cents
        : 0,
      depositLabel,
      depositCents,
      durationLabel: formatDuration(selectedService.duration_min),
      dateLabel,
      timeLabel: selectedSlot,
      payload: {
        typeId: selectedTechnique.id,
        serviceId: selectedService.id,
        date: selectedDate,
        slot: selectedSlot,
      },
    } satisfies SummarySnapshot
  }, [selectedDate, selectedService, selectedSlot, selectedTechnique])

  useEffect(() => {
    setAppointmentId(null)
    setSummarySnapshot(null)
    setModalError(null)
    setIsSummaryModalOpen(false)
    setIsProcessingPayment(false)
    setActionMessage(null)
    setIsPayLaterNoticeOpen(false)
  }, [selectedServiceId, selectedTechniqueId, selectedDate, selectedSlot])

  const ensureSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      throw new Error('Não foi possível validar sua sessão. Faça login novamente.')
    }

    const session = data.session
    if (!session) {
      window.location.href = '/login'
      throw new Error('Faça login para continuar.')
    }

    return session
  }, [])

  const closeSummaryModal = useCallback(() => {
    setIsSummaryModalOpen(false)
    setModalError(null)
  }, [])

  const isCurrentSelectionBooked = useMemo(() => {
    if (!summaryData || !summarySnapshot || !appointmentId) return false

    return (
      summarySnapshot.payload.serviceId === summaryData.payload.serviceId &&
      summarySnapshot.payload.typeId === summaryData.payload.typeId &&
      summarySnapshot.payload.date === summaryData.payload.date &&
      summarySnapshot.payload.slot === summaryData.payload.slot
    )
  }, [appointmentId, summaryData, summarySnapshot])

  const handleContinue = useCallback(async () => {
    if (!summaryData) return

    setModalError(null)

    if (isCurrentSelectionBooked) {
      setIsSummaryModalOpen(true)
      return
    }

    if (isCreatingAppointment) return

    const currentSummary = summaryData
    setIsCreatingAppointment(true)
    setActionMessage(null)

    try {
      const scheduledDate = combineDateAndTime(
        currentSummary.payload.date,
        currentSummary.payload.slot,
      )
      if (!scheduledDate) {
        throw new Error('Horário selecionado inválido. Escolha outro horário.')
      }

      const session = await ensureSession()

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          service_id: currentSummary.payload.serviceId,
          service_type_id: currentSummary.payload.typeId,
          scheduled_at: scheduledDate.toISOString(),
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : typeof payload?.message === 'string'
            ? payload.message
            : 'Não foi possível criar o agendamento. Tente novamente.'
        throw new Error(message)
      }

      const responseData = await res.json().catch(() => null)
      const newAppointmentId =
        typeof responseData?.appointment_id === 'string'
          ? responseData.appointment_id
          : null

      if (!newAppointmentId) {
        throw new Error('Resposta inválida ao criar o agendamento. Tente novamente.')
      }

      setAppointmentId(newAppointmentId)
      setSummarySnapshot({
        ...currentSummary,
        payload: { ...currentSummary.payload },
      })
      setActionMessage({
        kind: 'success',
        text: `Agendamento criado para ${currentSummary.dateLabel} às ${currentSummary.timeLabel}. ID ${newAppointmentId}.`,
      })
      setIsSummaryModalOpen(true)
    } catch (error) {
      console.error('Erro ao criar agendamento', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível criar o agendamento. Tente novamente.'
      setActionMessage({ kind: 'error', text: message })
    } finally {
      setIsCreatingAppointment(false)
    }
  }, [ensureSession, isCreatingAppointment, isCurrentSelectionBooked, summaryData])

  const handlePayDeposit = useCallback(async () => {
    if (!summarySnapshot || summarySnapshot.depositCents <= 0) {
      setModalError('Este agendamento não possui sinal disponível para pagamento.')
      return
    }

    if (!appointmentId) {
      setModalError('Crie um agendamento antes de iniciar o pagamento.')
      return
    }

    if (!stripePromise) {
      setModalError('Checkout indisponível. Verifique a configuração do Stripe.')
      return
    }

    setModalError(null)
    setIsProcessingPayment(true)

    try {
      const session = await ensureSession()

      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ appointment_id: appointmentId, mode: 'deposit' }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Não foi possível iniciar o checkout.'
        setModalError(message)
        return
      }

      const payload = await res.json().catch(() => null)
      const clientSecret =
        typeof payload?.client_secret === 'string' ? payload.client_secret : null

      if (!clientSecret) {
        setModalError('Resposta inválida do servidor ao iniciar o checkout.')
        return
      }

      setIsSummaryModalOpen(false)
      closeSummaryModal()
      router.push(
        `/checkout?client_secret=${encodeURIComponent(clientSecret)}&appointment_id=${encodeURIComponent(appointmentId)}`,
      )
    } catch (error) {
      console.error('Erro ao iniciar o checkout', error)
      setModalError('Erro inesperado ao iniciar o checkout.')
    } finally {
      setIsProcessingPayment(false)
    }
  }, [appointmentId, closeSummaryModal, ensureSession, router, summarySnapshot])

  const handlePayLater = useCallback(() => {
    closeSummaryModal()
    setIsPayLaterNoticeOpen(true)
  }, [closeSummaryModal])

  const handleConfirmPayLaterNotice = useCallback(() => {
    setIsPayLaterNoticeOpen(false)
    router.push('/agendamentos')
  }, [router])

  useEffect(() => {
    if (!isSummaryModalOpen) return
    if (typeof window === 'undefined') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSummaryModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeSummaryModal, isSummaryModalOpen])

  useEffect(() => {
    if (!isPayLaterNoticeOpen) return
    if (typeof window === 'undefined') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsPayLaterNoticeOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPayLaterNoticeOpen])

  const hasSummary = !!summaryData
  const canSelectTechnique = Boolean(selectedServiceId)
  const canSelectDate = Boolean(selectedTechniqueId)
  const canSelectTime = Boolean(selectedDate)
  const continueButtonLabel = isCreatingAppointment
    ? 'Criando agendamento…'
    : isCurrentSelectionBooked
    ? 'Ver resumo'
    : 'Continuar'
  const continueButtonDisabled = !summaryData || isCreatingAppointment
  const depositAvailable = Boolean(summarySnapshot && summarySnapshot.depositCents > 0)


  return (
    <ClientMenu disableContentPadding>
      <div className="page">
        <section
          ref={typeSectionRef}
          className="center"
          id="sectionTipo"
          aria-label="Escolha do tipo"
        >
            <div className="stack">
              <header
                className="reveal-seq reveal-title"
                data-visible={revealStage >= REVEAL_STAGE.TITLE}
              >
                <svg aria-hidden="true" className="diamond" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3l4 4-4 4-4-4 4-4Z" />
                  <path d="M12 13l4 4-4 4-4-4 4-4Z" />
                </svg>
                <h1>
                  Escolha <span className="muted2">seu</span> Procedimento:
                </h1>
              </header>
              <div
                className="glass reveal-seq reveal-content"
                aria-label="Tipos de procedimento"
                data-visible={revealStage >= REVEAL_STAGE.CONTENT}
              >
                <div
                  className="label reveal-seq reveal-description"
                  data-visible={revealStage >= REVEAL_STAGE.DESCRIPTION}
                >
                  TIPO
                </div>
                {catalogError && <div className="status status-error">{catalogError}</div>}
                {catalogStatus === 'loading' && !catalogError && (
                  <div className="status status-info">Carregando tipos…</div>
                )}
                {catalogStatus === 'ready' && availableServices.length === 0 && (
                  <div className="status status-info">Nenhum tipo disponível no momento.</div>
                )}
                {catalogStatus === 'ready' && availableServices.length > 0 ? (
                  <div className="grid tipo-grid">
                    {availableServices.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        className="card"
                        data-active={selectedServiceId === service.id ? 'true' : 'false'}
                        onClick={() => handleServiceSelect(service.id)}
                      >
                        <div className="card-inner">
                          <LashIcon />
                          <span>{service.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <footer
                className="reveal-seq reveal-content"
                data-visible={revealStage >= REVEAL_STAGE.CONTENT}
              >
                ROMEIKE BEAUTY
              </footer>
            </div>
          </section>
          {canSelectTechnique ? (
            <section
              ref={techniqueSectionRef}
              className="center"
              id="sectionTecnica"
              aria-label="Escolha da técnica"
            >
              <div className="stack">
                <header
                  className="reveal-seq reveal-title"
                  data-visible={revealStage >= REVEAL_STAGE.TITLE}
                >
                  <svg aria-hidden="true" className="diamond" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 3l4 4-4 4-4-4 4-4Z" />
                    <path d="M12 13l4 4-4 4-4-4 4-4Z" />
                  </svg>
                  <h1>
                    Escolha <span className="muted2">sua</span> Técnica:
                  </h1>
                </header>
                <div
                  className="glass reveal-seq reveal-content"
                  aria-label="Técnicas de cílios"
                  data-visible={revealStage >= REVEAL_STAGE.CONTENT}
                >
                  <div
                    className="label reveal-seq reveal-description"
                    data-visible={revealStage >= REVEAL_STAGE.DESCRIPTION}
                  >
                    TÉCNICA
                  </div>
                  {catalogStatus === 'ready' && selectedService ? (
                    <>
                      {selectedService.techniques.length > 0 ? (
                        <div className="grid tecnica-grid">
                          {visibleTechniques.map((technique) => (
                            <button
                              key={technique.id}
                              type="button"
                              className="card"
                              data-active={selectedTechniqueId === technique.id ? 'true' : 'false'}
                              onClick={() => handleTechniqueSelect(technique.id)}
                            >
                              <div className="card-inner">
                                <LashIcon />
                                <span>{technique.name}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="status status-info">Nenhuma técnica disponível para este tipo.</div>
                      )}
                      {!showAllTechniques && selectedService.techniques.length > visibleTechniques.length && (
                        <button type="button" className="view-more" onClick={() => setShowAllTechniques(true)}>
                          Ver mais técnicas
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="status status-info">Selecione um tipo para ver as técnicas disponíveis.</div>
                  )}
                </div>
              </div>
            </section>
          ) : null}
          {canSelectDate ? (
            <section
              ref={dateSectionRef}
              className="center"
              id="sectionDia"
              aria-label="Escolha do dia"
            >
              <div className="stack">
                <header
                  className="reveal-seq reveal-title"
                  data-visible={revealStage >= REVEAL_STAGE.TITLE}
                >
                  <svg aria-hidden="true" className="diamond" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 3l4 4-4 4-4-4 4-4Z" />
                    <path d="M12 13l4 4-4 4-4-4 4-4Z" />
                  </svg>
                  <h1>
                    Escolha <span className="muted2">o</span> Dia:
                  </h1>
                </header>
              <div
                className="glass reveal-seq reveal-content"
                aria-label="Escolha do dia"
                data-visible={revealStage >= REVEAL_STAGE.CONTENT}
              >
                <div
                  className="label reveal-seq reveal-description"
                  data-visible={revealStage >= REVEAL_STAGE.DESCRIPTION}
                >
                  DIA
                </div>
                {availabilityError && <div className="status status-error">{availabilityError}</div>}
                {!availabilityError && isLoadingAvailability && (
                  <div className="status status-info">Carregando disponibilidade…</div>
                )}
                <div className="calendar-head">
                  <button
                    type="button"
                    className="calendar-nav"
                    onClick={goToPreviousMonth}
                    disabled={!selectedTechnique}
                    aria-label="Mês anterior"
                  >
                    ‹
                  </button>
                  <div className="calendar-title" id="cal-title">
                    {monthTitle}
                  </div>
                  <button
                    type="button"
                    className="calendar-nav"
                    onClick={goToNextMonth}
                    disabled={!selectedTechnique}
                    aria-label="Próximo mês"
                  >
                    ›
                  </button>
                </div>
                <div className="calendar-grid" aria-hidden="true">
                  {calendarHeaderDays.map((label, index) => (
                    <div key={`dow-${index}`} className="calendar-day calendar-day-header">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="calendar-grid" role="grid">
                  {calendarDays.dayEntries.map(({ iso, day, isDisabled, state, isOutsideCurrentMonth }) => (
                    <button
                      key={iso}
                      type="button"
                      className="calendar-day"
                      data-state={state}
                      data-selected={!isOutsideCurrentMonth && selectedDate === iso}
                      data-outside-month={isOutsideCurrentMonth ? 'true' : 'false'}
                      aria-disabled={isDisabled}
                      disabled={isDisabled}
                      onClick={() => handleDaySelect(iso, isDisabled)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <div className="calendar-legend">
                  <span><span className="dot dot-available" /> Disponível</span>
                  <span><span className="dot dot-partial" /> Parcial</span>
                  <span><span className="dot dot-full" /> Lotado</span>
                  <span><span className="dot dot-mine" /> Meus</span>
                  <span><span className="dot dot-disabled" /> Indisponível</span>
                </div>
              </div>
              <footer
                className="reveal-seq reveal-content"
                data-visible={revealStage >= REVEAL_STAGE.CONTENT}
              >
                ROMEIKE BEAUTY
              </footer>
            </div>
          </section>
          ) : null}
          {canSelectTime ? (
            <section
              ref={timeSectionRef}
              className="center"
              id="sectionHorario"
              aria-label="Escolha do horário"
            >
              <div className="stack">
                <header
                  className="reveal-seq reveal-title"
                  data-visible={revealStage >= REVEAL_STAGE.TITLE}
                >
                  <svg aria-hidden="true" className="diamond" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 3l4 4-4 4-4-4 4-4Z" />
                    <path d="M12 13l4 4-4 4-4-4 4-4Z" />
                  </svg>
                  <h1>
                    Escolha <span className="muted2">o</span> Horário:
                  </h1>
                </header>
                <div
                  className="glass reveal-seq reveal-content"
                  aria-label="Escolha do horário"
                  data-visible={revealStage >= REVEAL_STAGE.CONTENT}
                >
                <div
                  className="label reveal-seq reveal-description"
                  data-visible={revealStage >= REVEAL_STAGE.DESCRIPTION}
                >
                  HORÁRIO
                </div>
                <div ref={slotsContainerRef} className="slots">
                  {!selectedDate ? (
                    <div className="status status-info">Escolha um dia para ver os horários disponíveis.</div>
                  ) : slots.length > 0 ? (
                    slots.map((slotValue) => {
                      const disabled = bookedSlots.has(slotValue)
                      return (
                        <button
                          key={slotValue}
                          type="button"
                          className="slot"
                          data-selected={selectedSlot === slotValue ? 'true' : 'false'}
                          data-busy={disabled ? 'true' : 'false'}
                          onClick={() => handleSlotSelect(slotValue, disabled)}
                          disabled={disabled}
                        >
                          {slotValue}
                        </button>
                      )
                    })
                  ) : (
                    <div className="status status-info">Sem horários para este dia.</div>
                  )}
                </div>
                {actionMessage ? (
                  <div className={`status ${actionMessage.kind === 'success' ? 'status-success' : 'status-error'}`}>
                    {actionMessage.text}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="continue-button"
                  onClick={handleContinue}
                  disabled={continueButtonDisabled}
                >
                  {continueButtonLabel}
                </button>
              </div>
              <footer
                className="reveal-seq reveal-content"
                data-visible={revealStage >= REVEAL_STAGE.CONTENT}
              >
                ROMEIKE BEAUTY
              </footer>
            </div>
          </section>
          ) : null}
        {hasSummary ? (
          <div className="summary-bar" data-visible={hasSummary ? 'true' : 'false'} ref={summaryRef}>
            <div className="summary-details">
              <div className="summary-item">
                <span className="summary-label">Tipo</span>
                <span className="summary-value">{summaryData?.typeName}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Técnica</span>
                <span className="summary-value">{summaryData?.techniqueName}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Valor</span>
                <span className="summary-value">{summaryData?.priceLabel}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Duração</span>
                <span className="summary-value">{summaryData?.durationLabel}</span>
              </div>
              <div className="summary-item summary-item-full">
                <span className="summary-label">Horário</span>
                <span className="summary-value">
                  {summaryData?.dateLabel} às {summaryData?.timeLabel}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="summary-action"
              onClick={handleContinue}
              disabled={continueButtonDisabled}
            >
              {continueButtonLabel}
            </button>
          </div>
        ) : null}
        {summarySnapshot ? (
          <div className="modal" data-open={isSummaryModalOpen ? 'true' : 'false'}>
            <div className="modal-backdrop" onClick={closeSummaryModal} aria-hidden="true" />
            <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="appointment-summary-title">
              <h2 id="appointment-summary-title" className="modal-title">
                Resumo do agendamento
              </h2>
              <div className="modal-body">
                <div className="modal-line">
                  <span>Tipo</span>
                  <strong>{summarySnapshot.typeName}</strong>
                </div>
                <div className="modal-line">
                  <span>Técnica</span>
                  <strong>{summarySnapshot.techniqueName}</strong>
                </div>
                <div className="modal-line">
                  <span>Horário</span>
                  <strong>
                    {summarySnapshot.dateLabel} às {summarySnapshot.timeLabel}
                  </strong>
                </div>
                <div className="modal-line">
                  <span>Duração</span>
                  <strong>{summarySnapshot.durationLabel}</strong>
                </div>
                <div className="modal-line">
                  <span>Valor</span>
                  <strong>{summarySnapshot.priceLabel}</strong>
                </div>
                {summarySnapshot.depositCents > 0 ? (
                  <div className="modal-line">
                    <span>Sinal</span>
                    <strong>{summarySnapshot.depositLabel}</strong>
                  </div>
                ) : null}
              </div>
              {modalError ? <div className="status status-error">{modalError}</div> : null}
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-button"
                  onClick={handlePayDeposit}
                  disabled={isProcessingPayment || !depositAvailable}
                >
                  {isProcessingPayment ? 'Processando…' : 'Pagar sinal'}
                </button>
                <button type="button" className="modal-button secondary" onClick={handlePayLater} disabled={isProcessingPayment}>
                  Pagar depois
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {isPayLaterNoticeOpen ? (
          <div className="modal" data-open="true">
            <div className="modal-backdrop" onClick={() => setIsPayLaterNoticeOpen(false)} aria-hidden="true" />
            <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="pay-later-title">
              <h2 id="pay-later-title" className="modal-title">
                Pagamento na clínica
              </h2>
              <div className="modal-body">
                Seu agendamento foi criado com sucesso. Conclua o pagamento no dia do atendimento.
              </div>
              <div className="modal-actions">
                <button type="button" className="modal-button" onClick={handleConfirmPayLaterNotice}>
                  Ver meus agendamentos
                </button>
                <button type="button" className="modal-button secondary" onClick={() => setIsPayLaterNoticeOpen(false)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {isAdmin ? (
          <>
            <button id="paletteBtn" title="Personalizar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="9" />
                <path d="M14.8 14.8a3 3 0 1 1-4.6-3.6" />
                <path d="M7.2 7.2l1.8 1.8" />
                <path d="M16.8 7.2l-1.8 1.8" />
              </svg>
            </button>
            <div id="palettePanel">
              <div id="panelScroll">
                <div className="pal-section">
                  <h3>Cards (livre)</h3>
                  <div className="row">
                    <span className="small">Superior</span>
                    <input type="color" className="colorpicker" id="cardTop" defaultValue="#eaf7ef" />
                  </div>
                  <div className="row">
                    <span className="small">Inferior</span>
                    <input type="color" className="colorpicker" id="cardBottom" defaultValue="#daefe2" />
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="cardTopHex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="addCardTop" type="button">
                      Aplicar sup.
                    </button>
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="cardBottomHex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="addCardBottom" type="button">
                      Aplicar inf.
                    </button>
                  </div>
                  <div className="row">
                    <span className="small">Borda card</span>
                    <input type="color" className="colorpicker" id="cardBorderColor" defaultValue="#ffffff" />
                  </div>
                  <div className="row">
                    <span className="small">Opacidade borda</span>
                    <input
                      type="range"
                      className="range"
                      id="cardBorderAlpha"
                      min="0"
                      max="1"
                      step="0.01"
                      defaultValue="0.86"
                    />
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="cardBorderHex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="applyCardBorderHex" type="button">
                      Aplicar borda
                    </button>
                  </div>
                </div>
                <div className="pal-section">
                  <h3>Container (fundo)</h3>
                  <div className="pal-options">
                    <div className="swatch" style={{ background: '#cfe6d5' }} data-css="--bg-top:#cfe6d5;--bg-bottom:#eef3e6" />
                    <div className="swatch" style={{ background: '#e3e8df' }} data-css="--bg-top:#e3e8df;--bg-bottom:#f2f3ef" />
                    <div className="swatch" style={{ background: '#dbece3' }} data-css="--bg-top:#dbece3;--bg-bottom:#eef4ec" />
                  </div>
                  <div className="row">
                    <span className="small">Topo</span>
                    <input type="color" className="colorpicker" id="bgTop" defaultValue="#cfe6d5" />
                  </div>
                  <div className="row">
                    <span className="small">Base</span>
                    <input type="color" className="colorpicker" id="bgBottom" defaultValue="#eef3e6" />
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="bgTopHex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="addBgTop" type="button">
                      Aplicar topo
                    </button>
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="bgBottomHex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="addBgBottom" type="button">
                      Aplicar base
                    </button>
                  </div>
                  <div className="hr" />
                  <div className="row">
                    <span className="small">Borda vidro</span>
                    <input type="color" className="colorpicker" id="glassBorderColor" defaultValue="#ffffff" />
                  </div>
                  <div className="row">
                    <span className="small">Opacidade borda</span>
                    <input
                      type="range"
                      className="range"
                      id="glassBorderAlpha"
                      min="0"
                      max="1"
                      step="0.01"
                      defaultValue="0.78"
                    />
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="glassBorderHex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="applyGlassBorderHex" type="button">
                      Aplicar borda
                    </button>
                  </div>
                </div>
                <div className="pal-section">
                  <h3>Overlay (vidro)</h3>
                  <div className="pal-options">
                    <div className="swatch" style={{ background: 'rgba(236,250,241,.34)' }} data-css="--glass:rgba(236,250,241,.34)" />
                    <div className="swatch" style={{ background: 'rgba(240,245,240,.42)' }} data-css="--glass:rgba(240,245,240,.42)" />
                    <div className="swatch" style={{ background: 'rgba(230,240,235,.50)' }} data-css="--glass:rgba(230,240,235,.50)" />
                  </div>
                  <div className="row">
                    <span className="small">Cor</span>
                    <input type="color" className="colorpicker" id="glassColor" defaultValue="#ecfaf1" />
                  </div>
                  <div className="row">
                    <span className="small">Opacidade</span>
                    <input
                      type="range"
                      className="range"
                      id="glassAlpha"
                      min="0"
                      max="1"
                      step="0.01"
                      defaultValue="0.34"
                    />
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="glassHex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="applyGlassHex" type="button">
                      Aplicar cor
                    </button>
                  </div>
                </div>
                <div className="pal-section">
                  <h3>Bolhas</h3>
                  <div className="pal-options">
                    <div className="swatch" style={{ background: '#7aa98a' }} data-css="--dark:#7aa98a;--light:#bcd6c3" />
                    <div className="swatch" style={{ background: '#86b79c' }} data-css="--dark:#86b79c;--light:#cae0cf" />
                    <div className="swatch" style={{ background: '#9ccbb1' }} data-css="--dark:#9ccbb1;--light:#d7ede1" />
                  </div>
                  <div className="row">
                    <span className="small">Escura</span>
                    <input type="color" className="colorpicker" id="bubbleDark" defaultValue="#7aa98a" />
                  </div>
                  <div className="row">
                    <span className="small">Clara</span>
                    <input type="color" className="colorpicker" id="bubbleLight" defaultValue="#bcd6c3" />
                  </div>
                  <div className="row">
                    <span className="small">Opac. mín</span>
                    <input
                      type="range"
                      className="range"
                      id="bubbleAlphaMin"
                      min="0"
                      max="1"
                      step="0.01"
                      defaultValue="0.40"
                    />
                  </div>
                  <div className="row">
                    <span className="small">Opac. máx</span>
                    <input
                      type="range"
                      className="range"
                      id="bubbleAlphaMax"
                      min="0"
                      max="1"
                      step="0.01"
                      defaultValue="0.85"
                    />
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="bubbleDarkHex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="applyBubbleDark" type="button">
                      Aplicar escura
                    </button>
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="bubbleLightHex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="applyBubbleLight" type="button">
                      Aplicar clara
                    </button>
                  </div>
                </div>
                <div className="pal-section">
                  <h3>Textos &amp; Títulos</h3>
                  <div className="pal-options">
                    <div className="swatch" style={{ background: '#183f2e' }} data-css="--ink:#183f2e;--muted:#6a8f7f;--muted-2:#5f8c79" />
                    <div className="swatch" style={{ background: '#224c3a' }} data-css="--ink:#224c3a;--muted:#7da08d;--muted-2:#5f8c79" />
                    <div className="swatch" style={{ background: '#123628' }} data-css="--ink:#123628;--muted:#5a7a6a;--muted-2:#497565" />
                  </div>
                  <div className="row">
                    <span className="small">Primária</span>
                    <input type="color" className="colorpicker" id="textInk" defaultValue="#183f2e" />
                  </div>
                  <div className="row">
                    <span className="small">Muted</span>
                    <input type="color" className="colorpicker" id="textMuted" defaultValue="#6a8f7f" />
                  </div>
                  <div className="row">
                    <span className="small">Muted 2</span>
                    <input type="color" className="colorpicker" id="textMuted2" defaultValue="#5f8c79" />
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="textInkHex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="applyTextInk" type="button">
                      Aplicar prim.
                    </button>
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="textMutedHex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="applyTextMuted" type="button">
                      Aplicar muted
                    </button>
                  </div>
                  <div className="row">
                    <input type="text" className="input-hex" id="textMuted2Hex" placeholder="#RRGGBB" />
                    <button className="btn-mini" id="applyTextMuted2" type="button">
                      Aplicar muted2
                    </button>
                  </div>
                  <div className="hr" />
                  <div className="row">
                    <span className="small">Fonte texto</span>
                    <select
                      id="fontBody"
                      className="colorpicker"
                      defaultValue="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'"
                    >
                      <option value="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'">
                        Inter
                      </option>
                      <option value="Roboto, system-ui, -apple-system, Segoe UI, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'">
                        Roboto
                      </option>
                      <option value="Poppins, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">
                        Poppins
                      </option>
                    </select>
                  </div>
                  <div className="row">
                    <span className="small">Fonte título</span>
                    <select id="fontHeading" className="colorpicker" defaultValue="Fraunces, 'Playfair Display', Georgia, serif">
                      <option value="Fraunces, 'Playfair Display', Georgia, serif">Fraunces</option>
                      <option value="'Playfair Display', Georgia, serif">Playfair Display</option>
                      <option value="Poppins, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">Poppins</option>
                      <option value="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">Inter</option>
                    </select>
                  </div>
                  <div className="row">
                    <span className="small">Texto base (px)</span>
                    <input type="number" id="sizeBase" className="colorpicker" min="10" max="28" step="1" defaultValue="16" />
                  </div>
                  <div className="row">
                    <span className="small">Título H1 (px)</span>
                    <input type="number" id="sizeH1" className="colorpicker" min="20" max="80" step="1" />
                  </div>
                  <div className="row">
                    <span className="small">Texto cards (px)</span>
                    <input type="number" id="sizeCard" className="colorpicker" min="10" max="36" step="1" />
                  </div>
                  <div className="row">
                    <span className="small">Label/muted (px)</span>
                    <input type="number" id="sizeLabel" className="colorpicker" min="8" max="24" step="1" defaultValue="11" />
                  </div>
                </div>
                <div className="pal-section">
                  <h3>Adicionar nova fonte</h3>
                  <div className="row">
                    <span className="small">CSS URL</span>
                    <input
                      type="text"
                      id="fontUrl"
                      className="colorpicker"
                      placeholder="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap"
                    />
                  </div>
                  <div className="row">
                    <span className="small">Family</span>
                    <input type="text" id="fontFamilyName" className="colorpicker" placeholder="DM Sans, sans-serif" />
                  </div>
                  <div className="row">
                    <span className="small">Aplicar em</span>
                    <select id="fontApplyWhere" className="colorpicker" defaultValue="body">
                      <option value="body">Texto</option>
                      <option value="heading">Título</option>
                      <option value="both">Ambos</option>
                    </select>
                  </div>
                  <div className="row">
                    <button className="btn-mini" id="addFontBtn" type="button">
                      Adicionar &amp; aplicar
                    </button>
                  </div>
                </div>
              </div>
              <button id="saveBtn" type="button">
                Salvar (baixar HTML)
              </button>
            </div>
          </>
        ) : null}
      </div>
    </ClientMenu>
  )
}

