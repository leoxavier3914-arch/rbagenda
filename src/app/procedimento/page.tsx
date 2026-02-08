'use client'

import { useEffect } from 'react'

const PROCEDIMENTO_CSS = /* css */ `
:root{
  --ink:#183f2e; --muted:#6a8f7f; --muted-2:#5f8c79;
  --bg-top:#7D9782; --bg-bottom:#DFE9E2;
  --glass:rgba(236,250,241,.34); --glass-stroke:rgba(255,255,255,.78);
  --inner-top:#F3FCF6; --inner-bottom:#C9E0D1;
  --shadow-xl:0 28px 76px rgba(28,75,56,.14);
  --radius-outer:28px; --radius-inner:22px;
  --dark:#7aa98a; --light:#bcd6c3;
  --font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
  --heading-font: Fraunces, "Playfair Display", Georgia, serif;
  --base-font-size: 16px;
  --heading-size: 28px;
  --card-text-size: ;
  --label-size: 11px;
  --card-stroke: rgba(255, 255, 255, 0.3);
  --lava-alpha-min: 0.40;
  --lava-alpha-max: 0.85;
}

body.procedimento-screen{
  margin:0;
  font-family:var(--font-family);
  font-size:var(--base-font-size);
  color:var(--ink);
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
  background:radial-gradient(120% 120% at 10% 0%, var(--bg-top) 0%, var(--bg-bottom) 62%);
  background-attachment: fixed;
  overflow-x:hidden;
  display:block !important;
}

body.procedimento-screen .brand-texture-overlay{display:none!important}

body.procedimento-screen .procedimento-root *{box-sizing:border-box}
body.procedimento-screen .procedimento-root{position:relative;min-height:100vh;z-index:0}

body.procedimento-screen .texture{position:fixed;inset:-20%;z-index:0;pointer-events:none;opacity:.22;mix-blend-mode:multiply}
body.procedimento-screen .texture svg{width:100%;height:100%;display:block}
body.procedimento-screen .lamp{position:fixed;inset:-12vh -12vw;z-index:0;pointer-events:none;overflow:hidden}
body.procedimento-screen .lava{position:absolute;inset:0;width:100%;height:100%;display:block}
body.procedimento-screen .lava.dark{mix-blend-mode:multiply;filter:blur(26px) contrast(1.05)}
body.procedimento-screen .lava.light{mix-blend-mode:screen;filter:blur(30px) contrast(1.04)}

body.procedimento-screen .page{position:relative;min-height:100svh;z-index:1}
body.procedimento-screen .center{min-height:100svh;display:grid;place-items:center;padding:calc(18px + env(safe-area-inset-top)) 18px calc(18px + env(safe-area-inset-bottom));position:relative}
body.procedimento-screen .center + .center{ margin-top:-1px; }
body.procedimento-screen .stack{display:grid;justify-items:center;gap:clamp(12px,2.2vw,18px)}
body.procedimento-screen header{text-align:center}
body.procedimento-screen .diamond{display:block;margin:0 auto 10px;width:22px;height:22px;color:color-mix(in srgb,var(--ink)72%,transparent)}
body.procedimento-screen h1{
  font-family:var(--heading-font);
  font-weight:700;
  font-size: var(--heading-size, clamp(30px,5.4vw,48px));
  line-height:1.06;margin:0;letter-spacing:-.01em
}
body.procedimento-screen h1 .muted2{ color:var(--muted-2); font-style:normal; }

body.procedimento-screen .glass{
  width:clamp(320px,92vw,720px);
  display:inline-block;
  background:var(--glass);
  background-image:
    linear-gradient(180deg, rgba(255,255,255,.28), rgba(255,255,255,0) 22%),
    radial-gradient(120% 120% at 50% -10%, rgba(255,255,255,.14), transparent 60%);
  border:1.2px solid var(--glass-stroke);
  border-radius:var(--radius-outer);
  box-shadow:var(--shadow-xl);
  padding:clamp(14px,2.6vw,22px);
  min-height: var(--glass-min-height, auto);
  position:relative;
  z-index:1;
}
@supports (backdrop-filter:blur(18px)) or (-webkit-backdrop-filter:blur(18px)){
  body.procedimento-screen .glass{backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%)}
}

body.procedimento-screen .label{text-align:center;font-size:var(--label-size);letter-spacing:.22em;color:var(--muted);margin-bottom:12px}
body.procedimento-screen .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:clamp(12px,2vw,18px)}
body.procedimento-screen .card{
  position:relative;aspect-ratio:6/5;border-radius:var(--radius-inner);
  border:1.6px solid var(--card-stroke);
  background:linear-gradient(180deg,var(--inner-top),var(--inner-bottom));
  box-shadow:0 14px 28px rgba(28,75,56,.10),inset 0 1px 0 rgba(255,255,255,.9),inset 0 -14px 20px rgba(143,196,170,.12);
  display:grid;place-items:center;padding:10px;color:var(--ink);text-decoration:none;transition:transform .15s ease,box-shadow .22s ease;overflow:hidden;will-change:transform
}
body.procedimento-screen .card::before{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:0 14px 24px rgba(255,255,255,.25) inset;pointer-events:none}
body.procedimento-screen .card:hover{transform:translateY(-2px)}
body.procedimento-screen .card:active{transform:translateY(0)}
body.procedimento-screen .card:focus{outline:none}
body.procedimento-screen .card:focus-visible{box-shadow:0 0 0 4px rgba(143,196,170,.35),0 12px 28px rgba(28,75,56,.10),inset 0 1px 0 rgba(255,255,255,.9)}
body.procedimento-screen .card-inner{display:flex;flex-direction:column;align-items:center;gap:12px}
body.procedimento-screen .card svg{width:clamp(28px,6vw,34px);height:auto;stroke:currentColor;stroke-width:2.2;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.96}
body.procedimento-screen .card span{font-size: var(--card-text-size, clamp(16px,2.8vw,20px)); font-weight:600}
body.procedimento-screen footer{text-align:center;font-size:12px;letter-spacing:.34em;color:color-mix(in srgb,var(--ink)74%,transparent);border:none;background:transparent}

@media(max-width:480px){body.procedimento-screen .lamp{inset:-10vh -14vw}}

body.procedimento-screen #paletteBtn{
  position:fixed;bottom:22px;right:22px;z-index:30;
  width:46px;height:46px;border-radius:50%;
  border:1px solid rgba(255,255,255,.8);
  background:rgba(255,255,255,.3);
  backdrop-filter:blur(8px) saturate(160%);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 18px rgba(0,0,0,.2);
  cursor:pointer;transition:.25s;
}
body.procedimento-screen #paletteBtn:hover{transform:scale(1.06)}
body.procedimento-screen #paletteBtn svg{width:22px;height:22px;stroke:#183f2e;opacity:.9}

body.procedimento-screen #palettePanel{
  position:fixed;top:0;right:0;width:300px;height:100%;
  transform:translate3d(110%,0,0); opacity:0; pointer-events:none;
  will-change:transform,opacity;
  overflow:hidden;
  backdrop-filter:blur(18px) saturate(160%);
  background:rgba(240,245,240,.68);
  box-shadow:-4px 0 20px rgba(0,0,0,.15);
  transition:transform .33s cubic-bezier(.4,0,.2,1), opacity .2s ease-out;
  z-index:29;padding:16px;display:flex;flex-direction:column;gap:14px;
}
body.procedimento-screen #palettePanel.open{ transform:translate3d(0,0,0); opacity:1; pointer-events:auto; }
body.procedimento-screen #panelScroll{ overflow-y:auto; -webkit-overflow-scrolling:touch; height:100%; padding-bottom:72px; }

body.procedimento-screen .pal-section{border-top:1px solid rgba(255,255,255,.6);padding-top:12px;margin-top:8px}
body.procedimento-screen .pal-section:first-child{border-top:none;padding-top:0;margin-top:0}
body.procedimento-screen .pal-section h3{font-size:13px;margin:0 0 8px;color:#183f2e}
body.procedimento-screen .pal-options{display:flex;flex-wrap:wrap;gap:8px}
body.procedimento-screen .swatch{ width:26px;height:26px;border-radius:50%; border:1px solid rgba(0,0,0,.12);cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,.15); }
body.procedimento-screen .row{display:flex;gap:8px;align-items:center;margin:6px 0}
body.procedimento-screen .colorpicker{flex:1}
body.procedimento-screen .range{width:100%}
body.procedimento-screen .small{font-size:12px;color:#2a4738;opacity:.9}
body.procedimento-screen .input-hex{flex:1;min-width:0}
body.procedimento-screen .btn-mini{ padding:6px 10px;border-radius:10px;border:1px solid rgba(0,0,0,.12); background:rgba(255,255,255,.65);backdrop-filter:blur(6px); cursor:pointer }
body.procedimento-screen .hr{height:1px;background:rgba(0,0,0,.08);margin:6px 0}
body.procedimento-screen #saveBtn{
  position:absolute;left:16px;right:16px;bottom:16px;height:44px;
  border-radius:14px;border:1px solid rgba(0,0,0,.12);
  background:rgba(255,255,255,.8);
  box-shadow:0 6px 22px rgba(0,0,0,.18);
  font-weight:600;cursor:pointer
}

body.procedimento-screen #sectionTecnica .tech-wrap,
body.procedimento-screen #sectionTecnica .tech-viewport,
body.procedimento-screen #sectionTecnica .tech-track,
body.procedimento-screen #sectionTecnica .tech-slide{background:transparent!important;border:0!important;box-shadow:none!important;outline:0!important}

body.procedimento-screen .tech-wrap{ position:relative; background:transparent; }
body.procedimento-screen .tech-viewport{ overflow:hidden; background:transparent; padding:0; margin:0; border:0; }
body.procedimento-screen .tech-track{ display:grid; grid-template-columns: var(--tech-cols, 100% 100% 100%); transition: transform .35s cubic-bezier(.4,0,.2,1); will-change: transform; background:transparent; margin:0; }
body.procedimento-screen .tech-slide{ padding:0; background:transparent; }
body.procedimento-screen .tech-nav-bar{position:relative;z-index:2;
  display:flex; align-items:center; justify-content:center; gap:10px;
  margin-top:8px;
}
body.procedimento-screen .tech-arrow{
  width:38px;height:38px;border-radius:12px;border:1px solid rgba(0,0,0,.1);
  background:rgba(255,255,255,.8);box-shadow:0 6px 16px rgba(0,0,0,.14);
  display:grid;place-items:center;cursor:pointer;user-select:none;
}
body.procedimento-screen .tech-arrow[disabled]{opacity:.45;pointer-events:none}
body.procedimento-screen .tech-dots{ display:flex;align-items:center;gap:6px; margin:0 6px }
body.procedimento-screen .tech-dot{ width:8px;height:8px;border-radius:50%; background:rgba(0,0,0,.2) }
body.procedimento-screen .tech-dot.active{ background:rgba(0,0,0,.5) }

body.procedimento-screen .placeholder{
  text-align:center;
  font-weight:600;
  font-size: clamp(16px, 2.8vw, 20px);
  color: var(--ink);
  opacity:.92;
  padding: 24px 8px;
}
`


type LavaInstance = {
  reseed: () => void
}

type LavaController = {
  greens: string[]
  accents: string[]
  instances: LavaInstance[]
  reseedAll: () => void
}

type TechniqueEntry = {
  key: string
  label: string
  icon: string
}

declare global {
  interface Window {
    LAVA?: LavaController
    syncLavaPaletteFromVars?: () => void
  }
}

const TECHNIQUES: TechniqueEntry[] = [
  { key: 'classica',   label: 'Clássica (1:1)',    icon: `<path d='M3 12c2.8-3.2 15.2-3.2 18 0'/>` },
  { key: 'hibrida',    label: 'Híbrida',           icon: `<path d='M4 10c3-2 13-2 16 0M6 14c4-1 8-1 12 0'/>` },
  { key: 'vol2d',      label: 'Volume 2D',         icon: `<path d='M5 12q7-6 14 0M8 14q3-2 8 0'/>` },
  { key: 'vol3d',      label: 'Volume 3D',         icon: `<path d='M4 12q8-7 16 0M7 14q5-3 10 0M9 16q3-1 6 0'/>` },
  { key: 'vol5d',      label: 'Volume 5D',         icon: `<path d='M3 12q9-8 18 0M6 14q7-4 12 0M8 16q5-2 8 0M10 18q3-1 4 0M12 20q1 0 2 0'/>` },
  { key: 'vol8d',      label: 'Volume 8D',         icon: `<path d='M3 12q9-8 18 0M5 13.5q7-6 14 0M7 15q6-4 10 0M9 16.5q5-3 8 0M11 18q3-2 4 0M6 18.5q4-2 12 0'/>` },
  { key: 'brasileiro', label: 'Volume Brasileiro', icon: `<path d='M4 11c2-4 14-4 16 0M7 15c4-3 6-3 10 0'/>` },
  { key: 'foxy',       label: 'Foxy Eyes',         icon: `<path d='M3 12c4-5 14-5 18 0M17 10l4-2M3 14l4 2'/>` },
  { key: 'anime',      label: 'Anime',             icon: `<path d='M6 11c4-3 8-3 12 0M8 14l2-2m4 2l2-2'/>` },
]

const TECHNIQUES_PER_PAGE = 4

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

function mixHexColors(colorA: string, colorB: string, ratio: number): string {
  const a = hexToRgb(colorA)
  const b = hexToRgb(colorB)
  const mix = (channelA: number, channelB: number) => Math.round(channelA + (channelB - channelA) * ratio)
  return `#${[mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

export default function ProcedimentoPage(): JSX.Element {
  useEffect(() => {
    const body = document.body
    body.classList.add('procedimento-screen')

    const updatedVars = new Set<string>()
    const cleanupFns: Array<() => void> = []

    const styleNode = document.getElementById('procedimento-style') as HTMLStyleElement | null

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2)

    const lavaController: LavaController =
      window.LAVA ?? {
        greens: [],
        accents: ['rgba(255,255,255,0.5)', 'rgba(0,0,0,0.2)'],
        instances: [],
        reseedAll() {
          this.instances.forEach((instance) => instance.reseed())
        },
      }

    window.LAVA = lavaController

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

    const paletteBtn = document.getElementById('paletteBtn') as HTMLButtonElement | null
    const palettePanel = document.getElementById('palettePanel') as HTMLDivElement | null
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement | null

    const bubbleDarkValue = bubbleDark?.value ?? '#7aa98a'
    const bubbleLightValue = bubbleLight?.value ?? '#bcd6c3'

    const LAVA_CONFIG = {
      dark: { count: 24, radius: [90, 150] as [number, number], speed: 1.2 },
      light: { count: 22, radius: [80, 130] as [number, number], speed: 1.0 },
    }

    type LavaBlob = {
      x: number
      y: number
      r: number
      a: number
      vx: number
      vy: number
      color: string
      opacity: number
    }

    type LavaLayerState = {
      width: number
      height: number
      blobs: LavaBlob[]
      time: number
      raf?: number
      destroyed: boolean
    }

    const lavaInstances: LavaInstance[] = []
    lavaController.instances = lavaInstances

    const updatedTechniques = [...TECHNIQUES]
    let techniquePage = 0

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

    function buildLavaPalette() {
      const dark = getComputedStyle(document.documentElement).getPropertyValue('--dark').trim() || bubbleDarkValue
      const light = getComputedStyle(document.documentElement).getPropertyValue('--light').trim() || bubbleLightValue
      const steps = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.85, 0.92, 0.97]
      return steps.map((step) => mixHexColors(dark, light, step))
    }

    function syncLavaPaletteFromVars() {
      lavaController.greens = buildLavaPalette()
      lavaController.reseedAll()
    }

    window.syncLavaPaletteFromVars = syncLavaPaletteFromVars

    const rand = (min: number, max: number) => min + Math.random() * (max - min)

    const pick = <T,>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)]

    function createLavaLayer(canvasId: string, type: 'dark' | 'light') {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return

      const state: LavaLayerState = {
        width: 0,
        height: 0,
        blobs: [],
        time: 0,
        destroyed: false,
      }

      const resize = () => {
        const rect = canvas.getBoundingClientRect()
        state.width = Math.ceil(rect.width * devicePixelRatio)
        state.height = Math.ceil(rect.height * devicePixelRatio)
        canvas.width = state.width
        canvas.height = state.height
        canvas.style.transform = 'translateZ(0)'
      }

      const reseed = () => {
        const config = LAVA_CONFIG[type]
        const minOpacity = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lava-alpha-min')) || 0.4
        const maxOpacity = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lava-alpha-max')) || 0.85
        resize()
        state.blobs = []
        for (let index = 0; index < config.count; index += 1) {
          state.blobs.push({
            x: rand(0, state.width),
            y: rand(0, state.height),
            r: rand(config.radius[0], config.radius[1]) * devicePixelRatio,
            a: rand(0, Math.PI * 2),
            vx: rand(-1, 1) * config.speed * devicePixelRatio,
            vy: rand(-1, 1) * config.speed * devicePixelRatio,
            color: pick([...lavaController.greens, ...lavaController.accents]),
            opacity: rand(minOpacity, maxOpacity),
          })
        }
      }

      const tick = () => {
        if (state.destroyed) return
        state.time += 1
        context.clearRect(0, 0, state.width, state.height)
        context.globalCompositeOperation = 'lighter'
        for (const blob of state.blobs) {
          blob.x += blob.vx
          blob.y += blob.vy
          const bounds = 200 * devicePixelRatio
          if (blob.x < -bounds || blob.x > state.width + bounds) blob.vx *= -1
          if (blob.y < -bounds || blob.y > state.height + bounds) blob.vy *= -1
          const projectedRadius = blob.r * (1 + Math.sin(state.time * 0.02 + blob.a) * 0.05)
          context.globalAlpha = blob.opacity
          context.fillStyle = blob.color
          context.beginPath()
          context.arc(blob.x, blob.y, projectedRadius, 0, Math.PI * 2)
          context.fill()
        }
        state.raf = window.requestAnimationFrame(tick)
      }

      const resizeHandler = () => resize()
      window.addEventListener('resize', resizeHandler)
      cleanupFns.push(() => {
        window.removeEventListener('resize', resizeHandler)
        state.destroyed = true
        if (state.raf) window.cancelAnimationFrame(state.raf)
      })

      lavaInstances.push({ reseed })
      reseed()
      tick()
    }

    lavaController.greens = buildLavaPalette()
    createLavaLayer('lavaDark', 'dark')
    createLavaLayer('lavaLight', 'light')

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
      window.LAVA?.reseedAll()
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

    paletteBtn?.addEventListener('click', () => {
      palettePanel?.classList.toggle('open')
    })

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

    saveBtn?.addEventListener('click', () => {
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
    })

    const tipoGrid = document.getElementById('tipoGrid') as HTMLDivElement | null
    tipoGrid?.addEventListener('click', (event) => {
      const card = (event.target as HTMLElement).closest<HTMLButtonElement>('.card')
      if (!card) return
      const tipo = card.getAttribute('data-tipo')
      if (tipo) {
        sessionStorage.setItem('rb_tipo', tipo)
        document.getElementById('sectionTecnica')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })

    const techGrid = document.getElementById('techGrid') as HTMLDivElement | null
    const techPrev = document.getElementById('techPrev') as HTMLButtonElement | null
    const techNext = document.getElementById('techNext') as HTMLButtonElement | null
    const techDots = document.getElementById('techDots') as HTMLDivElement | null

    function renderTechPage() {
      if (!techGrid || !techDots) return
      techGrid.innerHTML = ''
      const start = techniquePage * TECHNIQUES_PER_PAGE
      const items = updatedTechniques.slice(start, start + TECHNIQUES_PER_PAGE)
      items.forEach((tech) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'card'
        button.setAttribute('data-tech', tech.key)
        button.innerHTML = `<div class="card-inner"><svg viewBox="0 0 24 24">${tech.icon}</svg><span>${tech.label}</span></div>`
        techGrid.appendChild(button)
      })
      for (let index = items.length; index < TECHNIQUES_PER_PAGE; index += 1) {
        const filler = document.createElement('div')
        filler.className = 'card'
        filler.style.visibility = 'hidden'
        techGrid.appendChild(filler)
      }
      if (techPrev) techPrev.disabled = techniquePage === 0
      if (techNext) techNext.disabled = techniquePage === Math.ceil(updatedTechniques.length / TECHNIQUES_PER_PAGE) - 1
      techDots.innerHTML = ''
      const pages = Math.ceil(updatedTechniques.length / TECHNIQUES_PER_PAGE)
      for (let index = 0; index < pages; index += 1) {
        const dot = document.createElement('div')
        dot.className = `tech-dot${index === techniquePage ? ' active' : ''}`
        dot.addEventListener('click', () => {
          techniquePage = index
          renderTechPage()
        })
        techDots.appendChild(dot)
      }
    }

    techPrev?.addEventListener('click', () => {
      if (techniquePage > 0) {
        techniquePage -= 1
        renderTechPage()
      }
    })

    techNext?.addEventListener('click', () => {
      const pages = Math.ceil(updatedTechniques.length / TECHNIQUES_PER_PAGE)
      if (techniquePage < pages - 1) {
        techniquePage += 1
        renderTechPage()
      }
    })

    techGrid?.addEventListener('click', (event) => {
      const card = (event.target as HTMLElement).closest<HTMLButtonElement>('.card')
      if (!card || card.style.visibility === 'hidden') return
      const tech = card.getAttribute('data-tech')
      if (tech) {
        sessionStorage.setItem('rb_tecnica', tech)
        document.getElementById('sectionDia')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })

    renderTechPage()

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
      body.classList.remove('procedimento-screen')
      document.documentElement.classList.remove('force-motion')
      updatedVars.forEach((name) => {
        document.documentElement.style.removeProperty(name)
      })
      cleanupFns.forEach((fn) => fn())
      lavaController.instances = []
      if (window.LAVA === lavaController) {
        delete window.LAVA
      }
      if (window.syncLavaPaletteFromVars === syncLavaPaletteFromVars) {
        delete window.syncLavaPaletteFromVars
      }
    }
  }, [])

  return (
    <>
      <style id="procedimento-style" dangerouslySetInnerHTML={{ __html: PROCEDIMENTO_CSS }} />
      <div className="procedimento-root">
        <div className="texture" aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <filter id="mottle" x="-50%" y="-50%" width="200%" height="200%">
                <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="11" result="turb" />
                <feGaussianBlur stdDeviation="18" in="turb" result="blur" />
                <feBlend in="SourceGraphic" in2="blur" mode="multiply" />
              </filter>
            </defs>
            <rect x="0" y="0" width="100" height="100" fill="#e9f3ee" filter="url(#mottle)" />
          </svg>
        </div>
        <div className="lamp" aria-hidden="true">
          <canvas id="lavaDark" className="lava dark" />
          <canvas id="lavaLight" className="lava light" />
        </div>
        <div className="page">
          <section className="center" id="sectionTipo" aria-label="Escolha do tipo">
            <div className="stack">
              <header>
                <svg aria-hidden="true" className="diamond" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3l4 4-4 4-4-4 4-4Z" />
                  <path d="M12 13l4 4-4 4-4-4 4-4Z" />
                </svg>
                <h1>
                  Escolha <span className="muted2">seu</span> Procedimento:
                </h1>
              </header>
              <div className="glass" aria-label="Tipos de procedimento">
                <div className="label">TIPO</div>
                <div className="grid" id="tipoGrid">
                  <button type="button" className="card" data-tipo="aplicacao">
                    <div className="card-inner">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 12c2.5-3 13.5-3 16 0" />
                        <path d="M7 13.5l-1 2" />
                        <path d="M10 14l-.6 2" />
                        <path d="M13.5 14l.6 2" />
                        <path d="M17 13.5l1 2" />
                      </svg>
                      <span>Aplicação</span>
                    </div>
                  </button>
                  <button type="button" className="card" data-tipo="manutencao">
                    <div className="card-inner">
                      <svg viewBox="0 0 24 24">
                        <path d="M21 7l-3 3-3-3 3-3 3 3Z" />
                        <path d="M13 15l-6 6" />
                        <circle cx="6" cy="18" r="2" />
                      </svg>
                      <span>Manutenção</span>
                    </div>
                  </button>
                  <button type="button" className="card" data-tipo="reaplicacao">
                    <div className="card-inner">
                      <svg viewBox="0 0 24 24">
                        <path d="M20 11a8 8 0 1 1-2.3-5.7" />
                        <path d="M20 4v7" />
                      </svg>
                      <span>Reaplicação</span>
                    </div>
                  </button>
                  <button type="button" className="card" data-tipo="remocao">
                    <div className="card-inner">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 3s6 6.7 6 10.2A6 6 0 1 1 6 13.2C6 9.7 12 3 12 3Z" />
                      </svg>
                      <span>Remoção</span>
                    </div>
                  </button>
                </div>
              </div>
              <footer>ROMEIKE BEAUTY</footer>
            </div>
          </section>
          <section className="center" id="sectionTecnica" aria-label="Escolha da técnica">
            <div className="stack">
              <header>
                <svg aria-hidden="true" className="diamond" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3l4 4-4 4-4-4 4-4Z" />
                  <path d="M12 13l4 4-4 4-4-4 4-4Z" />
                </svg>
                <h1>
                  Escolha <span className="muted2">sua</span> Técnica:
                </h1>
              </header>
              <div className="glass" aria-label="Técnicas de cílios">
                <div className="label">TÉCNICA</div>
                <div className="grid" id="techGrid" />
              </div>
              <nav className="tech-nav-bar" aria-label="Navegação de páginas">
                <button className="tech-arrow" id="techPrev" aria-label="Anterior" disabled>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <div className="tech-dots" id="techDots" aria-hidden="true" />
                <button className="tech-arrow" id="techNext" aria-label="Próxima">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </nav>
            </div>
          </section>
          <section className="center" id="sectionDia" aria-label="Escolha do dia">
            <div className="stack">
              <header>
                <svg aria-hidden="true" className="diamond" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3l4 4-4 4-4-4 4-4Z" />
                  <path d="M12 13l4 4-4 4-4-4 4-4Z" />
                </svg>
                <h1>
                  Escolha <span className="muted2">o</span> Dia:
                </h1>
              </header>
              <div className="glass" aria-label="Escolha do dia">
                <div className="label">DIA</div>
                <div className="placeholder" id="calendarPlaceholder">
                  calendário aqui
                </div>
              </div>
              <footer>ROMEIKE BEAUTY</footer>
            </div>
          </section>
          <section className="center" id="sectionHorario" aria-label="Escolha do horário">
            <div className="stack">
              <header>
                <svg aria-hidden="true" className="diamond" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3l4 4-4 4-4-4 4-4Z" />
                  <path d="M12 13l4 4-4 4-4-4 4-4Z" />
                </svg>
                <h1>
                  Escolha <span className="muted2">o</span> Horário:
                </h1>
              </header>
              <div className="glass" aria-label="Escolha do horário">
                <div className="label">HORÁRIO</div>
                <div className="placeholder" id="timePlaceholder">
                  horários disponiveis
                </div>
              </div>
              <footer>ROMEIKE BEAUTY</footer>
            </div>
          </section>
        </div>
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
                <input type="range" className="range" id="cardBorderAlpha" min="0" max="1" step="0.01" defaultValue="0.86" />
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
                <input type="range" className="range" id="glassBorderAlpha" min="0" max="1" step="0.01" defaultValue="0.78" />
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
                <input type="range" className="range" id="glassAlpha" min="0" max="1" step="0.01" defaultValue="0.34" />
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
                <input type="range" className="range" id="bubbleAlphaMin" min="0" max="1" step="0.01" defaultValue="0.40" />
              </div>
              <div className="row">
                <span className="small">Opac. máx</span>
                <input type="range" className="range" id="bubbleAlphaMax" min="0" max="1" step="0.01" defaultValue="0.85" />
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
                <select id="fontBody" className="colorpicker" defaultValue="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'">
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
      </div>
    </>
  )
}

