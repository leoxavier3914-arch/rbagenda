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

import { ProcedimentoCard } from './@components/ProcedimentoCard'
import { ProcedimentoGrid } from './@components/ProcedimentoGrid'
import { ProcedimentoHeader } from './@components/ProcedimentoHeader'
import { ProcedimentoWrapper } from './@components/ProcedimentoWrapper'
import styles from './procedimento.module.css'

import { LashIcon } from '@/components/client/LashIcon'
import { supabase } from '@/lib/db'
import {
  DEFAULT_FALLBACK_BUFFER_MINUTES,
  DEFAULT_SLOT_TEMPLATE,
  DEFAULT_TIMEZONE,
  buildAvailabilityData,
  formatDateToIsoDay,
} from '@/lib/availability'
import { stripePromise } from '@/lib/stripeClient'
import { useLavaLamp } from '@/components/LavaLampProvider'
import { useClientAvailability } from '@/hooks/useClientAvailability'

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

const DEFAULT_SERVICE_LABELS = [
  'Aplicação',
  'Manutenção',
  'Reaplicação',
  'Remoção',
] as const

const FALLBACK_BUFFER_MINUTES = DEFAULT_FALLBACK_BUFFER_MINUTES
const WORK_DAY_END = '18:00'

type PaletteState = {
  cardTop: string
  cardBottom: string
  cardBorderColor: string
  cardBorderAlpha: number
  bgTop: string
  bgBottom: string
  glassBorderColor: string
  glassBorderAlpha: number
  glassColor: string
  glassAlpha: number
  bubbleDark: string
  bubbleLight: string
  bubbleAlphaMin: number
  bubbleAlphaMax: number
  textInk: string
  textMuted: string
  textMuted2: string
  fontBody: string
  fontHeading: string
  sizeBase: number
  sizeH1: number
  sizeCard: number
  sizeLabel: number
}

const PALETTE_VAR_NAMES = [
  '--inner-top',
  '--inner-bottom',
  '--bg-top',
  '--bg-bottom',
  '--glass',
  '--glass-stroke',
  '--card-stroke',
  '--dark',
  '--light',
  '--lava-alpha-min',
  '--lava-alpha-max',
  '--ink',
  '--muted',
  '--muted-2',
  '--font-family',
  '--heading-font',
  '--base-font-size',
  '--heading-size',
  '--card-text-size',
  '--label-size',
] as const

const DEFAULT_PALETTE: PaletteState = {
  cardTop: '#eaf7ef',
  cardBottom: '#daefe2',
  cardBorderColor: '#ffffff',
  cardBorderAlpha: 0.86,
  bgTop: '#cfe6d5',
  bgBottom: '#eef3e6',
  glassBorderColor: '#ffffff',
  glassBorderAlpha: 0.78,
  glassColor: '#ecfaf1',
  glassAlpha: 0.34,
  bubbleDark: '#7aa98a',
  bubbleLight: '#bcd6c3',
  bubbleAlphaMin: 0.4,
  bubbleAlphaMax: 0.85,
  textInk: '#183f2e',
  textMuted: '#6a8f7f',
  textMuted2: '#5f8c79',
  fontBody: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'",
  fontHeading: "Fraunces, 'Playfair Display', Georgia, serif",
  sizeBase: 16,
  sizeH1: 28,
  sizeCard: 20,
  sizeLabel: 11,
}

type PaletteHexInputs = {
  cardTop: string
  cardBottom: string
  cardBorder: string
  bgTop: string
  bgBottom: string
  glass: string
  glassBorder: string
  bubbleDark: string
  bubbleLight: string
  textInk: string
  textMuted: string
  textMuted2: string
}

type FontOption = { label: string; value: string }

const BODY_FONT_OPTIONS: FontOption[] = [
  {
    label: 'Inter',
    value: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'",
  },
  {
    label: 'Roboto',
    value: "Roboto, system-ui, -apple-system, Segoe UI, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'",
  },
  {
    label: 'Poppins',
    value: 'Poppins, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  },
]

const HEADING_FONT_OPTIONS: FontOption[] = [
  { label: 'Fraunces', value: "Fraunces, 'Playfair Display', Georgia, serif" },
  { label: 'Playfair Display', value: "'Playfair Display', Georgia, serif" },
  { label: 'Poppins', value: 'Poppins, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' },
  { label: 'Inter', value: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" },
]

function parseCssNumeric(value: string, fallback: number) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseRgbaColor(value: string): { hex: string; alpha: number } | null {
  const match = value.match(/rgba?\(([^)]+)\)/i)
  if (!match) return null
  const parts = match[1].split(',').map((part) => part.trim())
  const [r, g, b, a = '1'] = parts
  const toHex = (component: string) => {
    const parsed = Math.max(0, Math.min(255, Number(component)))
    return parsed.toString(16).padStart(2, '0')
  }
  const alpha = parseCssNumeric(a, 1)
  return { hex: `#${[r, g, b].map(toHex).join('')}`, alpha }
}

function AdminCustomizationPanel({ refreshPalette }: { refreshPalette: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [palette, setPalette] = useState<PaletteState>(DEFAULT_PALETTE)
  const [hexInputs, setHexInputs] = useState<PaletteHexInputs>({
    cardTop: '',
    cardBottom: '',
    cardBorder: '',
    bgTop: '',
    bgBottom: '',
    glass: '',
    glassBorder: '',
    bubbleDark: '',
    bubbleLight: '',
    textInk: '',
    textMuted: '',
    textMuted2: '',
  })
  const [fontUrl, setFontUrl] = useState('')
  const [fontFamilyName, setFontFamilyName] = useState('')
  const [fontApplyWhere, setFontApplyWhere] = useState<'body' | 'heading' | 'both'>('body')
  const [bodyOptions, setBodyOptions] = useState(BODY_FONT_OPTIONS)
  const [headingOptions, setHeadingOptions] = useState(HEADING_FONT_OPTIONS)
  const paletteTouchedRef = useRef(false)
  const mountedRef = useRef(false)

  const updateHexInput = useCallback((key: keyof PaletteHexInputs, value: string) => {
    setHexInputs((prev) => ({ ...prev, [key]: value }))
  }, [])

  const markPaletteChanged = useCallback(() => {
    paletteTouchedRef.current = true
  }, [])

  const setPaletteValues = useCallback((updates: Partial<PaletteState>, options?: { markPalette?: boolean }) => {
    setPalette((prev) => ({ ...prev, ...updates }))
    if (options?.markPalette) {
      markPaletteChanged()
    }
  }, [markPaletteChanged])

  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    setPalette((prev) => {
      const glass = parseRgbaColor(style.getPropertyValue('--glass'))
      const glassStroke = parseRgbaColor(style.getPropertyValue('--glass-stroke'))
      const cardStroke = parseRgbaColor(style.getPropertyValue('--card-stroke'))
      return {
        ...prev,
        cardTop: style.getPropertyValue('--inner-top').trim() || prev.cardTop,
        cardBottom: style.getPropertyValue('--inner-bottom').trim() || prev.cardBottom,
        cardBorderColor: cardStroke?.hex ?? prev.cardBorderColor,
        bgTop: style.getPropertyValue('--bg-top').trim() || prev.bgTop,
        bgBottom: style.getPropertyValue('--bg-bottom').trim() || prev.bgBottom,
        glassBorderColor: glassStroke?.hex ?? prev.glassBorderColor,
        bubbleDark: style.getPropertyValue('--dark').trim() || prev.bubbleDark,
        bubbleLight: style.getPropertyValue('--light').trim() || prev.bubbleLight,
        textInk: style.getPropertyValue('--ink').trim() || prev.textInk,
        textMuted: style.getPropertyValue('--muted').trim() || prev.textMuted,
        textMuted2: style.getPropertyValue('--muted-2').trim() || prev.textMuted2,
        fontBody: style.getPropertyValue('--font-family').trim() || prev.fontBody,
        fontHeading: style.getPropertyValue('--heading-font').trim() || prev.fontHeading,
        sizeBase: parseCssNumeric(style.getPropertyValue('--base-font-size'), prev.sizeBase),
        sizeH1: parseCssNumeric(style.getPropertyValue('--heading-size'), prev.sizeH1),
        sizeCard: parseCssNumeric(style.getPropertyValue('--card-text-size'), prev.sizeCard),
        sizeLabel: parseCssNumeric(style.getPropertyValue('--label-size'), prev.sizeLabel),
        glassColor: glass?.hex ?? prev.glassColor,
        glassAlpha: glass?.alpha ?? prev.glassAlpha,
        glassBorderAlpha: glassStroke?.alpha ?? prev.glassBorderAlpha,
        cardBorderAlpha: cardStroke?.alpha ?? prev.cardBorderAlpha,
        bubbleAlphaMin: parseCssNumeric(style.getPropertyValue('--lava-alpha-min'), prev.bubbleAlphaMin),
        bubbleAlphaMax: parseCssNumeric(style.getPropertyValue('--lava-alpha-max'), prev.bubbleAlphaMax),
      }
    })
    mountedRef.current = true
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const updated: Array<[string, string]> = [
      ['--inner-top', palette.cardTop],
      ['--inner-bottom', palette.cardBottom],
      ['--bg-top', palette.bgTop],
      ['--bg-bottom', palette.bgBottom],
      ['--glass', rgbaFromHexAlpha(palette.glassColor, palette.glassAlpha)],
      ['--glass-stroke', rgbaFromHexAlpha(palette.glassBorderColor, palette.glassBorderAlpha)],
      ['--card-stroke', rgbaFromHexAlpha(palette.cardBorderColor, palette.cardBorderAlpha)],
      ['--dark', palette.bubbleDark],
      ['--light', palette.bubbleLight],
      ['--lava-alpha-min', String(palette.bubbleAlphaMin)],
      ['--lava-alpha-max', String(palette.bubbleAlphaMax)],
      ['--ink', palette.textInk],
      ['--muted', palette.textMuted],
      ['--muted-2', palette.textMuted2],
      ['--font-family', palette.fontBody],
      ['--heading-font', palette.fontHeading],
      ['--base-font-size', `${palette.sizeBase}px`],
      ['--heading-size', `${palette.sizeH1}px`],
      ['--card-text-size', `${palette.sizeCard}px`],
      ['--label-size', `${palette.sizeLabel}px`],
    ]

    updated.forEach(([name, value]) => {
      root.style.setProperty(name, value)
    })
  }, [palette])

  useEffect(
    () => () => {
      const root = document.documentElement
      PALETTE_VAR_NAMES.forEach((name) => {
        root.style.removeProperty(name)
      })
    },
    [],
  )

  useEffect(() => {
    if (!mountedRef.current || !paletteTouchedRef.current) return
    refreshPalette()
  }, [palette.bubbleDark, palette.bubbleLight, palette.bubbleAlphaMin, palette.bubbleAlphaMax, refreshPalette])

  const applyHexValue = useCallback(
    (key: keyof PaletteHexInputs, setter: (value: string) => void) => {
      const value = hexInputs[key].trim()
      if (!value || !isHex(value)) return
      setter(value)
      updateHexInput(key, value)
    },
    [hexInputs, updateHexInput],
  )

  const handleSwatchClick = useCallback(
    (rules: string) => {
      const entries = rules
        .split(';')
        .map((rule) => rule.trim())
        .filter(Boolean)
        .map((rule) => rule.split(':'))
        .filter(([prop, val]) => Boolean(prop) && Boolean(val)) as Array<[string, string]>

      const updates: Partial<PaletteState> = {}
      let paletteChanged = false

      entries.forEach(([prop, val]) => {
        const value = val.trim()
        switch (prop.trim()) {
          case '--glass': {
            const parsed = parseRgbaColor(value)
            if (parsed) {
              updates.glassColor = parsed.hex
              updates.glassAlpha = parsed.alpha
            }
            break
          }
          case '--glass-stroke':
            updates.glassBorderColor = value
            break
          case '--card-stroke':
            updates.cardBorderColor = value
            break
          case '--inner-top':
            updates.cardTop = value
            break
          case '--inner-bottom':
            updates.cardBottom = value
            break
          case '--bg-top':
            updates.bgTop = value
            break
          case '--bg-bottom':
            updates.bgBottom = value
            break
          case '--dark':
            updates.bubbleDark = value
            paletteChanged = true
            break
          case '--light':
            updates.bubbleLight = value
            paletteChanged = true
            break
          case '--ink':
            updates.textInk = value
            break
          case '--muted':
            updates.textMuted = value
            break
          case '--muted-2':
            updates.textMuted2 = value
            break
          default:
            break
        }
      })

      setPaletteValues(updates, { markPalette: paletteChanged })
    },
    [setPaletteValues],
  )

  const handleFontAdd = useCallback(() => {
    const url = fontUrl.trim()
    const family = fontFamilyName.trim()
    if (!url || !family) return
    const target = fontApplyWhere

    const linkExists = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).some(
      (link) => link.href === url,
    )
    if (!linkExists) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url
      document.head.appendChild(link)
    }

    if (target === 'body' || target === 'both') {
      setBodyOptions((prev) => (prev.some((option) => option.value === family) ? prev : [...prev, { label: family, value: family }]))
      setPaletteValues({ fontBody: family })
    }

    if (target === 'heading' || target === 'both') {
      setHeadingOptions((prev) =>
        prev.some((option) => option.value === family) ? prev : [...prev, { label: family, value: family }],
      )
      setPaletteValues({ fontHeading: family })
    }
  }, [fontApplyWhere, fontFamilyName, fontUrl, setPaletteValues])

  const handleSaveClick = useCallback(() => {
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
  }, [])

  const handleGlassAlphaChange = useCallback(
    (value: string) => {
      const parsed = Number.parseFloat(value)
      if (!Number.isFinite(parsed)) return
      setPaletteValues({ glassAlpha: Math.max(0, Math.min(1, parsed)) })
    },
    [setPaletteValues],
  )

  const handleBubbleAlphaChange = useCallback(
    (key: 'bubbleAlphaMin' | 'bubbleAlphaMax', value: string) => {
      const parsed = Number.parseFloat(value)
      if (!Number.isFinite(parsed)) return
      const clamped = Math.max(0, Math.min(1, parsed))
      setPalette((prev) => {
        let nextMin = key === 'bubbleAlphaMin' ? clamped : prev.bubbleAlphaMin
        let nextMax = key === 'bubbleAlphaMax' ? clamped : prev.bubbleAlphaMax
        if (key === 'bubbleAlphaMin' && nextMin > nextMax) {
          nextMax = nextMin
        } else if (key === 'bubbleAlphaMax' && nextMax < nextMin) {
          nextMin = nextMax
        }
        return { ...prev, bubbleAlphaMin: nextMin, bubbleAlphaMax: nextMax }
      })
      markPaletteChanged()
    },
    [markPaletteChanged],
  )

  const handleSizeChange = useCallback(
    (key: keyof Pick<PaletteState, 'sizeBase' | 'sizeH1' | 'sizeCard' | 'sizeLabel'>, value: string, fallback: number) => {
      const parsed = parseInt(value || `${fallback}`, 10)
      if (!Number.isFinite(parsed)) return
      setPaletteValues({ [key]: parsed } as Partial<PaletteState>)
    },
    [setPaletteValues],
  )

  const renderSwatch = (css: string, style: string) => (
    <div className={styles.swatch} style={{ background: style }} onClick={() => handleSwatchClick(css)} role="button" />
  )

  return (
    <>
      <button
        id="paletteBtn"
        className={styles.paletteButton}
        title="Personalizar"
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="9" />
          <path d="M14.8 14.8a3 3 0 1 1-4.6-3.6" />
          <path d="M7.2 7.2l1.8 1.8" />
          <path d="M16.8 7.2l-1.8 1.8" />
        </svg>
      </button>
      <div
        id="palettePanel"
        className={`${styles.palettePanel} ${isOpen ? styles.palettePanelOpen : ''}`}
        onClick={(event) => event.target === event.currentTarget && setIsOpen(false)}
      >
        <div id="panelScroll" className={styles.panelScroll}>
          <div className={styles.paletteSection}>
            <h3>Cards (livre)</h3>
            <div className={styles.row}>
              <span className={styles.small}>Superior</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="cardTop"
                value={palette.cardTop}
                onChange={(event) => setPaletteValues({ cardTop: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Inferior</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="cardBottom"
                value={palette.cardBottom}
                onChange={(event) => setPaletteValues({ cardBottom: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="cardTopHex"
                placeholder="#RRGGBB"
                value={hexInputs.cardTop}
                onChange={(event) => updateHexInput('cardTop', event.target.value)}
              />
              <button className={styles.btnMini} id="addCardTop" type="button" onClick={() => applyHexValue('cardTop', (value) => setPaletteValues({ cardTop: value }))}>
                Aplicar sup.
              </button>
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="cardBottomHex"
                placeholder="#RRGGBB"
                value={hexInputs.cardBottom}
                onChange={(event) => updateHexInput('cardBottom', event.target.value)}
              />
              <button
                className={styles.btnMini}
                id="addCardBottom"
                type="button"
                onClick={() => applyHexValue('cardBottom', (value) => setPaletteValues({ cardBottom: value }))}
              >
                Aplicar inf.
              </button>
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Borda card</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="cardBorderColor"
                value={palette.cardBorderColor}
                onChange={(event) => setPaletteValues({ cardBorderColor: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Opacidade borda</span>
              <input
                type="range"
                className={styles.range}
                id="cardBorderAlpha"
                min="0"
                max="1"
                step="0.01"
                value={palette.cardBorderAlpha}
                onChange={(event) => setPaletteValues({ cardBorderAlpha: Number(event.target.value) })}
              />
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="cardBorderHex"
                placeholder="#RRGGBB"
                value={hexInputs.cardBorder}
                onChange={(event) => updateHexInput('cardBorder', event.target.value)}
              />
              <button
                className={styles.btnMini}
                id="applyCardBorderHex"
                type="button"
                onClick={() => applyHexValue('cardBorder', (value) => setPaletteValues({ cardBorderColor: value }))}
              >
                Aplicar borda
              </button>
            </div>
          </div>
          <div className={styles.paletteSection}>
            <h3>Container (fundo)</h3>
            <div className={styles.paletteOptions}>
              {renderSwatch('--bg-top:#cfe6d5;--bg-bottom:#eef3e6', '#cfe6d5')}
              {renderSwatch('--bg-top:#e3e8df;--bg-bottom:#f2f3ef', '#e3e8df')}
              {renderSwatch('--bg-top:#dbece3;--bg-bottom:#eef4ec', '#dbece3')}
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Topo</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="bgTop"
                value={palette.bgTop}
                onChange={(event) => setPaletteValues({ bgTop: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Base</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="bgBottom"
                value={palette.bgBottom}
                onChange={(event) => setPaletteValues({ bgBottom: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="bgTopHex"
                placeholder="#RRGGBB"
                value={hexInputs.bgTop}
                onChange={(event) => updateHexInput('bgTop', event.target.value)}
              />
              <button className={styles.btnMini} id="addBgTop" type="button" onClick={() => applyHexValue('bgTop', (value) => setPaletteValues({ bgTop: value }))}>
                Aplicar topo
              </button>
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="bgBottomHex"
                placeholder="#RRGGBB"
                value={hexInputs.bgBottom}
                onChange={(event) => updateHexInput('bgBottom', event.target.value)}
              />
              <button className={styles.btnMini} id="addBgBottom" type="button" onClick={() => applyHexValue('bgBottom', (value) => setPaletteValues({ bgBottom: value }))}>
                Aplicar base
              </button>
            </div>
            <div className={styles.hr} />
            <div className={styles.row}>
              <span className={styles.small}>Borda vidro</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="glassBorderColor"
                value={palette.glassBorderColor}
                onChange={(event) => setPaletteValues({ glassBorderColor: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Opacidade borda</span>
              <input
                type="range"
                className={styles.range}
                id="glassBorderAlpha"
                min="0"
                max="1"
                step="0.01"
                value={palette.glassBorderAlpha}
                onChange={(event) => setPaletteValues({ glassBorderAlpha: Number(event.target.value) })}
              />
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="glassBorderHex"
                placeholder="#RRGGBB"
                value={hexInputs.glassBorder}
                onChange={(event) => updateHexInput('glassBorder', event.target.value)}
              />
              <button
                className={styles.btnMini}
                id="applyGlassBorderHex"
                type="button"
                onClick={() => applyHexValue('glassBorder', (value) => setPaletteValues({ glassBorderColor: value }))}
              >
                Aplicar borda
              </button>
            </div>
          </div>
          <div className={styles.paletteSection}>
            <h3>Overlay (vidro)</h3>
            <div className={styles.paletteOptions}>
              {renderSwatch('--glass:rgba(236,250,241,.34)', 'rgba(236,250,241,.34)')}
              {renderSwatch('--glass:rgba(240,245,240,.42)', 'rgba(240,245,240,.42)')}
              {renderSwatch('--glass:rgba(230,240,235,.50)', 'rgba(230,240,235,.50)')}
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Cor</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="glassColor"
                value={palette.glassColor}
                onChange={(event) => setPaletteValues({ glassColor: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Opacidade</span>
              <input
                type="range"
                className={styles.range}
                id="glassAlpha"
                min="0"
                max="1"
                step="0.01"
                value={palette.glassAlpha}
                onChange={(event) => handleGlassAlphaChange(event.target.value)}
              />
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="glassHex"
                placeholder="#RRGGBB"
                value={hexInputs.glass}
                onChange={(event) => updateHexInput('glass', event.target.value)}
              />
              <button className={styles.btnMini} id="applyGlassHex" type="button" onClick={() => applyHexValue('glass', (value) => setPaletteValues({ glassColor: value }))}>
                Aplicar cor
              </button>
            </div>
          </div>
          <div className={styles.paletteSection}>
            <h3>Bolhas</h3>
            <div className={styles.paletteOptions}>
              {renderSwatch('--dark:#7aa98a;--light:#bcd6c3', '#7aa98a')}
              {renderSwatch('--dark:#86b79c;--light:#cae0cf', '#86b79c')}
              {renderSwatch('--dark:#9ccbb1;--light:#d7ede1', '#9ccbb1')}
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Escura</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="bubbleDark"
                value={palette.bubbleDark}
                onChange={(event) => setPaletteValues({ bubbleDark: event.target.value }, { markPalette: true })}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Clara</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="bubbleLight"
                value={palette.bubbleLight}
                onChange={(event) => setPaletteValues({ bubbleLight: event.target.value }, { markPalette: true })}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Opac. mín</span>
              <input
                type="range"
                className={styles.range}
                id="bubbleAlphaMin"
                min="0"
                max="1"
                step="0.01"
                value={palette.bubbleAlphaMin}
                onChange={(event) => handleBubbleAlphaChange('bubbleAlphaMin', event.target.value)}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Opac. máx</span>
              <input
                type="range"
                className={styles.range}
                id="bubbleAlphaMax"
                min="0"
                max="1"
                step="0.01"
                value={palette.bubbleAlphaMax}
                onChange={(event) => handleBubbleAlphaChange('bubbleAlphaMax', event.target.value)}
              />
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="bubbleDarkHex"
                placeholder="#RRGGBB"
                value={hexInputs.bubbleDark}
                onChange={(event) => updateHexInput('bubbleDark', event.target.value)}
              />
              <button
                className={styles.btnMini}
                id="applyBubbleDark"
                type="button"
                onClick={() => applyHexValue('bubbleDark', (value) => setPaletteValues({ bubbleDark: value }, { markPalette: true }))}
              >
                Aplicar escura
              </button>
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="bubbleLightHex"
                placeholder="#RRGGBB"
                value={hexInputs.bubbleLight}
                onChange={(event) => updateHexInput('bubbleLight', event.target.value)}
              />
              <button
                className={styles.btnMini}
                id="applyBubbleLight"
                type="button"
                onClick={() => applyHexValue('bubbleLight', (value) => setPaletteValues({ bubbleLight: value }, { markPalette: true }))}
              >
                Aplicar clara
              </button>
            </div>
          </div>
          <div className={styles.paletteSection}>
            <h3>Textos &amp; Títulos</h3>
            <div className={styles.paletteOptions}>
              {renderSwatch('--ink:#183f2e;--muted:#6a8f7f;--muted-2:#5f8c79', '#183f2e')}
              {renderSwatch('--ink:#224c3a;--muted:#7da08d;--muted-2:#5f8c79', '#224c3a')}
              {renderSwatch('--ink:#123628;--muted:#5a7a6a;--muted-2:#497565', '#123628')}
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Primária</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="textInk"
                value={palette.textInk}
                onChange={(event) => setPaletteValues({ textInk: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Muted</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="textMuted"
                value={palette.textMuted}
                onChange={(event) => setPaletteValues({ textMuted: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Muted 2</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="textMuted2"
                value={palette.textMuted2}
                onChange={(event) => setPaletteValues({ textMuted2: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="textInkHex"
                placeholder="#RRGGBB"
                value={hexInputs.textInk}
                onChange={(event) => updateHexInput('textInk', event.target.value)}
              />
              <button className={styles.btnMini} id="applyTextInk" type="button" onClick={() => applyHexValue('textInk', (value) => setPaletteValues({ textInk: value }))}>
                Aplicar prim.
              </button>
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="textMutedHex"
                placeholder="#RRGGBB"
                value={hexInputs.textMuted}
                onChange={(event) => updateHexInput('textMuted', event.target.value)}
              />
              <button
                className={styles.btnMini}
                id="applyTextMuted"
                type="button"
                onClick={() => applyHexValue('textMuted', (value) => setPaletteValues({ textMuted: value }))}
              >
                Aplicar muted
              </button>
            </div>
            <div className={styles.row}>
              <input
                type="text"
                className={styles.inputHex}
                id="textMuted2Hex"
                placeholder="#RRGGBB"
                value={hexInputs.textMuted2}
                onChange={(event) => updateHexInput('textMuted2', event.target.value)}
              />
              <button
                className={styles.btnMini}
                id="applyTextMuted2"
                type="button"
                onClick={() => applyHexValue('textMuted2', (value) => setPaletteValues({ textMuted2: value }))}
              >
                Aplicar muted2
              </button>
            </div>
            <div className={styles.hr} />
            <div className={styles.row}>
              <span className={styles.small}>Fonte texto</span>
              <select
                id="fontBody"
                className={styles.colorpicker}
                value={palette.fontBody}
                onChange={(event) => setPaletteValues({ fontBody: event.target.value })}
              >
                {bodyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Fonte título</span>
              <select
                id="fontHeading"
                className={styles.colorpicker}
                value={palette.fontHeading}
                onChange={(event) => setPaletteValues({ fontHeading: event.target.value })}
              >
                {headingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Texto base (px)</span>
              <input
                type="number"
                id="sizeBase"
                className={styles.colorpicker}
                min="10"
                max="28"
                step="1"
                value={palette.sizeBase}
                onChange={(event) => handleSizeChange('sizeBase', event.target.value, DEFAULT_PALETTE.sizeBase)}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Título H1 (px)</span>
              <input
                type="number"
                id="sizeH1"
                className={styles.colorpicker}
                min="20"
                max="80"
                step="1"
                value={palette.sizeH1}
                onChange={(event) => handleSizeChange('sizeH1', event.target.value, DEFAULT_PALETTE.sizeH1)}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Texto cards (px)</span>
              <input
                type="number"
                id="sizeCard"
                className={styles.colorpicker}
                min="10"
                max="36"
                step="1"
                value={palette.sizeCard}
                onChange={(event) => handleSizeChange('sizeCard', event.target.value, DEFAULT_PALETTE.sizeCard)}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Label/muted (px)</span>
              <input
                type="number"
                id="sizeLabel"
                className={styles.colorpicker}
                min="8"
                max="24"
                step="1"
                value={palette.sizeLabel}
                onChange={(event) => handleSizeChange('sizeLabel', event.target.value, DEFAULT_PALETTE.sizeLabel)}
              />
            </div>
          </div>
          <div className={styles.paletteSection}>
            <h3>Adicionar nova fonte</h3>
            <div className={styles.row}>
              <span className={styles.small}>CSS URL</span>
              <input
                type="text"
                id="fontUrl"
                className={styles.colorpicker}
                placeholder="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap"
                value={fontUrl}
                onChange={(event) => setFontUrl(event.target.value)}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Family</span>
              <input
                type="text"
                id="fontFamilyName"
                className={styles.colorpicker}
                placeholder="DM Sans, sans-serif"
                value={fontFamilyName}
                onChange={(event) => setFontFamilyName(event.target.value)}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Aplicar em</span>
              <select
                id="fontApplyWhere"
                className={styles.colorpicker}
                value={fontApplyWhere}
                onChange={(event) => setFontApplyWhere(event.target.value as 'body' | 'heading' | 'both')}
              >
                <option value="body">Texto</option>
                <option value="heading">Título</option>
                <option value="both">Ambos</option>
              </select>
            </div>
            <div className={styles.row}>
              <button className={styles.btnMini} id="addFontBtn" type="button" onClick={handleFontAdd}>
                Adicionar &amp; aplicar
              </button>
            </div>
          </div>
        </div>
        <button id="saveBtn" type="button" onClick={handleSaveClick}>
          Salvar (baixar HTML)
        </button>
      </div>
    </>
  )
}

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
  const [userId, setUserId] = useState<string | null>(null)
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
  const [heroReady, setHeroReady] = useState(false)

  const {
    availability: availabilitySnapshot,
    isLoadingAvailability,
    availabilityError,
  } = useClientAvailability({
    enabled: Boolean(userId),
    subscribe: true,
    channel: 'procedimento-appointments',
    fallbackBufferMinutes: FALLBACK_BUFFER_MINUTES,
    timezone: DEFAULT_TIMEZONE,
    errorMessage: 'Não foi possível carregar a disponibilidade. Tente novamente mais tarde.',
  })

  const router = useRouter()
  const { refreshPalette } = useLavaLamp()
  const typeSectionRef = useRef<HTMLDivElement | null>(null)
  const techniqueSectionRef = useRef<HTMLDivElement | null>(null)
  const dateSectionRef = useRef<HTMLDivElement | null>(null)
  const timeSectionRef = useRef<HTMLDivElement | null>(null)
  const slotsContainerRef = useRef<HTMLDivElement | null>(null)
  const summaryRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setHeroReady(true)
  }, [])

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
    document.documentElement.classList.add('force-motion')
    if (typeof window !== 'undefined' && window.location.hash.includes('nomotion')) {
      document.documentElement.classList.remove('force-motion')
    }

    return () => {
      document.documentElement.classList.remove('force-motion')
    }
  }, [])

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
      availabilitySnapshot ??
      buildAvailabilityData([], userId, {
        fallbackBufferMinutes: FALLBACK_BUFFER_MINUTES,
        timezone: DEFAULT_TIMEZONE,
      }),
    [availabilitySnapshot, userId],
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

    const targetSection = pendingScrollTarget === 'technique'
      ? techniqueSectionRef.current
      : pendingScrollTarget === 'date'
        ? dateSectionRef.current
        : pendingScrollTarget === 'time'
          ? timeSectionRef.current
          : null

    targetSection?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })

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
    <ProcedimentoWrapper heroReady={heroReady}>
      <section
        ref={typeSectionRef}
        className={styles.section}
        id="sectionTipo"
        data-step="tipo"
        aria-label="Escolha do tipo"
      >
        <div className={styles.stack}>
          <ProcedimentoHeader>
            <>
              Escolha <span className={styles.subtitle}>seu</span> Procedimento:
            </>
          </ProcedimentoHeader>
          <div className={styles.glass} aria-label="Tipos de procedimento">
            <div className={styles.label}>TIPO</div>
            {catalogError && <div className={`${styles.status} ${styles.statusError}`}>{catalogError}</div>}
            {catalogStatus === 'ready' && availableServices.length === 0 && (
              <div className={`${styles.status} ${styles.statusInfo}`}>Nenhum tipo disponível no momento.</div>
            )}
            <ProcedimentoGrid variant="tipo">
              {catalogStatus === 'ready' && availableServices.length > 0 ? (
                availableServices.map((service) => (
                  <ProcedimentoCard
                    key={service.id}
                    active={selectedServiceId === service.id}
                    onClick={() => handleServiceSelect(service.id)}
                  >
                    <LashIcon />
                    <span>{service.name}</span>
                  </ProcedimentoCard>
                ))
              ) : (
                DEFAULT_SERVICE_LABELS.map((label) => (
                  <ProcedimentoCard key={label} as="div">
                    <LashIcon />
                    <span>{label}</span>
                  </ProcedimentoCard>
                ))
              )}
            </ProcedimentoGrid>
          </div>
          <footer className={styles.footer}>ROMEIKE BEAUTY</footer>
        </div>
      </section>

      {canSelectTechnique ? (
        <section
          ref={techniqueSectionRef}
          className={styles.section}
          id="sectionTecnica"
          data-step="tecnica"
          aria-label="Escolha da técnica"
        >
          <div className={styles.stack}>
            <ProcedimentoHeader className={styles.procedimentoHeader}>
              <>
                Escolha <span className={styles.subtitle}>sua</span> Técnica:
              </>
            </ProcedimentoHeader>
            <div className={styles.glass} aria-label="Técnicas de cílios">
              <div className={styles.label}>TÉCNICA</div>
              {catalogStatus === 'ready' && selectedService ? (
                <>
                  {selectedService.techniques.length > 0 ? (
                    <ProcedimentoGrid>
                      {visibleTechniques.map((technique) => (
                        <ProcedimentoCard
                          key={technique.id}
                          active={selectedTechniqueId === technique.id}
                          onClick={() => handleTechniqueSelect(technique.id)}
                        >
                          <LashIcon />
                          <span>{technique.name}</span>
                        </ProcedimentoCard>
                      ))}
                    </ProcedimentoGrid>
                  ) : (
                    <div className={`${styles.status} ${styles.statusInfo}`}>
                      Nenhuma técnica disponível para este tipo.
                    </div>
                  )}
                  {!showAllTechniques && selectedService.techniques.length > visibleTechniques.length && (
                    <button type="button" className={styles.viewMore} onClick={() => setShowAllTechniques(true)}>
                      Ver mais técnicas
                    </button>
                  )}
                </>
              ) : (
                <div className={`${styles.status} ${styles.statusInfo}`}>
                  Selecione um tipo para ver as técnicas disponíveis.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {canSelectDate ? (
        <section
          ref={dateSectionRef}
          className={styles.section}
          id="sectionDia"
          data-step="dia"
          aria-label="Escolha do dia"
        >
          <div className={styles.stack}>
            <ProcedimentoHeader className={styles.procedimentoHeader}>
              <>
                Escolha <span className={styles.subtitle}>o</span> Dia:
              </>
            </ProcedimentoHeader>
            <div className={styles.glass} aria-label="Escolha do dia">
              <div className={styles.label}>DIA</div>
              {availabilityError && <div className={`${styles.status} ${styles.statusError}`}>{availabilityError}</div>}
              {!availabilityError && isLoadingAvailability && (
                <div className={`${styles.status} ${styles.statusInfo}`}>Carregando disponibilidade…</div>
              )}
              <div className={styles.calendarHead}>
                <button
                  type="button"
                  className={styles.calendarNav}
                  onClick={goToPreviousMonth}
                  disabled={!selectedTechnique}
                  aria-label="Mês anterior"
                >
                  ‹
                </button>
                <div className={styles.calendarTitle} id="cal-title">
                  {monthTitle}
                </div>
                <button
                  type="button"
                  className={styles.calendarNav}
                  onClick={goToNextMonth}
                  disabled={!selectedTechnique}
                  aria-label="Próximo mês"
                >
                  ›
                </button>
              </div>
              <div className={styles.calendarGrid} aria-hidden="true">
                {calendarHeaderDays.map((label, index) => (
                  <div key={`dow-${index}`} className={`${styles.calendarDay} ${styles.calendarDayHeader}`}>
                    {label}
                  </div>
                ))}
              </div>
              <div className={styles.calendarGrid} role="grid">
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
                    onClick={() => handleDaySelect(iso, isDisabled)}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <div className={styles.calendarLegend}>
                <span className={styles.calendarLegendItem}>
                  <span className={`${styles.dot} ${styles.dotAvailable}`} /> Disponível
                </span>
                <span className={styles.calendarLegendItem}>
                  <span className={`${styles.dot} ${styles.dotPartial}`} /> Parcial
                </span>
                <span className={styles.calendarLegendItem}>
                  <span className={`${styles.dot} ${styles.dotFull}`} /> Lotado
                </span>
                <span className={styles.calendarLegendItem}>
                  <span className={`${styles.dot} ${styles.dotMine}`} /> Meus
                </span>
                <span className={styles.calendarLegendItem}>
                  <span className={`${styles.dot} ${styles.dotDisabled}`} /> Indisponível
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {canSelectTime ? (
        <section
          ref={timeSectionRef}
          className={styles.section}
          id="sectionHorario"
          data-step="horario"
          aria-label="Escolha do horário"
        >
          <div className={styles.stack}>
            <ProcedimentoHeader className={styles.procedimentoHeader}>
              <>
                Escolha <span className={styles.subtitle}>o</span> Horário:
              </>
            </ProcedimentoHeader>
            <div className={styles.glass} aria-label="Escolha do horário">
              <div className={styles.label}>HORÁRIO</div>
              <div ref={slotsContainerRef} className={styles.slots}>
                {!selectedDate ? (
                  <div className={`${styles.status} ${styles.statusInfo}`}>
                    Escolha um dia para ver os horários disponíveis.
                  </div>
                ) : slots.length > 0 ? (
                  slots.map((slotValue) => {
                    const disabled = bookedSlots.has(slotValue)
                    return (
                      <button
                        key={slotValue}
                        type="button"
                        className={styles.slot}
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
                  <div className={`${styles.status} ${styles.statusInfo}`}>Sem horários para este dia.</div>
                )}
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
              <button
                type="button"
                className={styles.continueButton}
                onClick={handleContinue}
                disabled={continueButtonDisabled}
              >
                {continueButtonLabel}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {hasSummary ? (
        <div className={styles.summaryBar} data-visible={hasSummary ? 'true' : 'false'} ref={summaryRef}>
          <div className={styles.summaryDetails}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Tipo</span>
              <span className={styles.summaryValue}>{summaryData?.typeName}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Técnica</span>
              <span className={styles.summaryValue}>{summaryData?.techniqueName}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Valor</span>
              <span className={styles.summaryValue}>{summaryData?.priceLabel}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Duração</span>
              <span className={styles.summaryValue}>{summaryData?.durationLabel}</span>
            </div>
            <div className={`${styles.summaryItem} ${styles.summaryItemFull}`}>
              <span className={styles.summaryLabel}>Horário</span>
              <span className={styles.summaryValue}>
                {summaryData?.dateLabel} às {summaryData?.timeLabel}
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.summaryAction}
            onClick={handleContinue}
            disabled={continueButtonDisabled}
          >
            {continueButtonLabel}
          </button>
        </div>
      ) : null}

      {summarySnapshot ? (
        <div className={styles.modal} data-open={isSummaryModalOpen ? 'true' : 'false'}>
          <div className={styles.modalBackdrop} onClick={closeSummaryModal} aria-hidden="true" />
          <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="appointment-summary-title">
            <h2 id="appointment-summary-title" className={styles.modalTitle}>
              Resumo do agendamento
            </h2>
            <div className={styles.modalBody}>
              <div className={styles.modalLine}>
                <span>Tipo</span>
                <strong>{summarySnapshot.typeName}</strong>
              </div>
              <div className={styles.modalLine}>
                <span>Técnica</span>
                <strong>{summarySnapshot.techniqueName}</strong>
              </div>
              <div className={styles.modalLine}>
                <span>Horário</span>
                <strong>
                  {summarySnapshot.dateLabel} às {summarySnapshot.timeLabel}
                </strong>
              </div>
              <div className={styles.modalLine}>
                <span>Duração</span>
                <strong>{summarySnapshot.durationLabel}</strong>
              </div>
              <div className={styles.modalLine}>
                <span>Valor</span>
                <strong>{summarySnapshot.priceLabel}</strong>
              </div>
              {summarySnapshot.depositCents > 0 ? (
                <div className={styles.modalLine}>
                  <span>Sinal</span>
                  <strong>{summarySnapshot.depositLabel}</strong>
                </div>
              ) : null}
            </div>
            {modalError ? <div className={`${styles.status} ${styles.statusError}`}>{modalError}</div> : null}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalButton}
                onClick={handlePayDeposit}
                disabled={isProcessingPayment || !depositAvailable}
              >
                {isProcessingPayment ? 'Processando…' : 'Pagar sinal'}
              </button>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.modalButtonSecondary}`}
                onClick={handlePayLater}
                disabled={isProcessingPayment}
              >
                Pagar depois
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPayLaterNoticeOpen ? (
        <div className={styles.modal} data-open="true">
          <div className={styles.modalBackdrop} onClick={() => setIsPayLaterNoticeOpen(false)} aria-hidden="true" />
          <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="pay-later-title">
            <h2 id="pay-later-title" className={styles.modalTitle}>
              Pagamento na clínica
            </h2>
            <div className={styles.modalBody}>
              Seu agendamento foi criado com sucesso. Conclua o pagamento no dia do atendimento.
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalButton} onClick={handleConfirmPayLaterNotice}>
                Ver meus agendamentos
              </button>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.modalButtonSecondary}`}
                onClick={() => setIsPayLaterNoticeOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAdmin ? <AdminCustomizationPanel refreshPalette={refreshPalette} /> : null}
    </ProcedimentoWrapper>
  )
}

