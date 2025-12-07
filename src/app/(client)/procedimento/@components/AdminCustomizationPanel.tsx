'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import styles from '../procedimento.module.css'

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
  fontBody:
    "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'",
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

type Props = {
  refreshPalette: () => void
}

export function AdminCustomizationPanel({ refreshPalette }: Props) {
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

  const handlePaletteReset = useCallback(() => {
    setPalette(DEFAULT_PALETTE)
    setHexInputs({
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
    setFontUrl('')
    setFontFamilyName('')
    setFontApplyWhere('body')
    setBodyOptions(BODY_FONT_OPTIONS)
    setHeadingOptions(HEADING_FONT_OPTIONS)
  }, [])

  const renderSwatch = useCallback(
    (rules: string, sample: string, label?: string) => (
      <button type="button" className={styles.swatch} style={{ background: sample }} onClick={() => handleSwatchClick(rules)}>
        {label}
      </button>
    ),
    [handleSwatchClick],
  )

  const handleGlassAlphaChange = useCallback(
    (value: string) => {
      const parsed = Math.max(0, Math.min(1, Number.parseFloat(value)))
      if (Number.isNaN(parsed)) return
      setPaletteValues({ glassAlpha: parsed })
    },
    [setPaletteValues],
  )

  const handleBubbleAlphaChange = useCallback(
    (key: 'bubbleAlphaMin' | 'bubbleAlphaMax', value: string) => {
      const parsed = Math.max(0, Math.min(1, Number.parseFloat(value)))
      if (Number.isNaN(parsed)) return
      setPaletteValues({ [key]: parsed } as Partial<PaletteState>, { markPalette: true })
    },
    [setPaletteValues],
  )

  const handleSizeChange = useCallback(
    (key: keyof Pick<PaletteState, 'sizeBase' | 'sizeH1' | 'sizeCard' | 'sizeLabel'>, value: string, fallback: number) => {
      const parsed = Number.parseInt(value, 10)
      if (Number.isNaN(parsed)) {
        setPaletteValues({ [key]: fallback } as Partial<PaletteState>)
        return
      }
      setPaletteValues({ [key]: parsed } as Partial<PaletteState>)
    },
    [setPaletteValues],
  )

  const handleSaveClick = useCallback(() => {
    const html = document.documentElement.outerHTML
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tema-procedimento.html'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return (
    <>
      <button
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-controls="admin-panel"
        type="button"
        className={styles.adminButton}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? 'Fechar painel' : 'Admin/Temas'}
      </button>
      <div id="admin-panel" className={styles.adminPanel} data-open={isOpen ? 'true' : 'false'}>
        <div className={styles.paletteContent}>
          <div className={styles.paletteHead}>
            <h2>Paleta</h2>
            <button type="button" className={styles.btnMini} onClick={handlePaletteReset}>
              Resetar
            </button>
          </div>
          <div className={styles.paletteSection}>
            <h3>Cartões</h3>
            <div className={styles.paletteOptions}>
              {renderSwatch('--inner-top:#eaf7ef;--inner-bottom:#daefe2', '#eaf7ef')}
              {renderSwatch('--inner-top:#f3f3f3;--inner-bottom:#e6e6e6', '#f3f3f3')}
              {renderSwatch('--inner-top:#f7f1e8;--inner-bottom:#eedfd0', '#f7f1e8')}
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Topo</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="cardTop"
                value={palette.cardTop}
                onChange={(event) => setPaletteValues({ cardTop: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Base</span>
              <input
                type="color"
                className={styles.colorpicker}
                id="cardBottom"
                value={palette.cardBottom}
                onChange={(event) => setPaletteValues({ cardBottom: event.target.value })}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Borda</span>
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
                id="cardTopHex"
                placeholder="#RRGGBB"
                value={hexInputs.cardTop}
                onChange={(event) => updateHexInput('cardTop', event.target.value)}
              />
              <button className={styles.btnMini} id="applyCardTopHex" type="button" onClick={() => applyHexValue('cardTop', (value) => setPaletteValues({ cardTop: value }))}>
                Aplicar topo
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
              <button className={styles.btnMini} id="applyCardBottomHex" type="button" onClick={() => applyHexValue('cardBottom', (value) => setPaletteValues({ cardBottom: value }))}>
                Aplicar base
              </button>
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
            <h3>Texto</h3>
            <div className={styles.row}>
              <span className={styles.small}>Ink</span>
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
            <div className={styles.hr} />
            <div className={styles.row}>
              <span className={styles.small}>Font texto</span>
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
              <span className={styles.small}>Font título</span>
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
              <span className={styles.small}>Tamanho base (px)</span>
              <input
                type="number"
                id="sizeBase"
                className={styles.colorpicker}
                min="12"
                max="24"
                step="1"
                value={palette.sizeBase}
                onChange={(event) => handleSizeChange('sizeBase', event.target.value, DEFAULT_PALETTE.sizeBase)}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Tamanho título (px)</span>
              <input
                type="number"
                id="sizeH1"
                className={styles.colorpicker}
                min="16"
                max="40"
                step="1"
                value={palette.sizeH1}
                onChange={(event) => handleSizeChange('sizeH1', event.target.value, DEFAULT_PALETTE.sizeH1)}
              />
            </div>
            <div className={styles.row}>
              <span className={styles.small}>Card (px)</span>
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
