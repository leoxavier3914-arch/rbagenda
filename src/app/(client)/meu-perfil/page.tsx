'use client'
/* eslint-disable @next/next/no-img-element */

import {
  type ChangeEvent,
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/db'

type Profile = {
  full_name: string | null
  whatsapp: string | null
  email: string | null
  birth_date: string | null
  role?: 'admin' | 'adminsuper' | 'client'
}

type ThemeState = {
  innerTop: string
  innerBottom: string
  cardBorderHex: string
  cardBorderAlpha: number
  bgTop: string
  bgBottom: string
  glassColor: string
  glassAlpha: number
  glassBorderHex: string
  glassBorderAlpha: number
  bubbleDark: string
  bubbleLight: string
  bubbleAlphaMin: number
  bubbleAlphaMax: number
}

const AVATAR_STORAGE_KEY = 'rb_meu_perfil_avatar'

const defaultTheme: ThemeState = {
  innerTop: '#F3FCF6',
  innerBottom: '#C9E0D1',
  cardBorderHex: '#FFFFFF',
  cardBorderAlpha: 0.3,
  bgTop: '#7D9782',
  bgBottom: '#DFE9E2',
  glassColor: '#ECFAF1',
  glassAlpha: 0.34,
  glassBorderHex: '#FFFFFF',
  glassBorderAlpha: 0.78,
  bubbleDark: '#7AA98A',
  bubbleLight: '#BCD6C3',
  bubbleAlphaMin: 0.4,
  bubbleAlphaMax: 0.85,
}

const HEX_REGEX = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/

const clampAlpha = (value: number) => {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

const normalizeHex = (value: string) => {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (withHash.length === 4) {
    return `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`.toUpperCase()
  }
  return withHash.toUpperCase()
}

const isHex = (value: string) => HEX_REGEX.test(value.trim())

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex).replace('#', '')
  const value = parseInt(normalized, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

const rgbToHex = (r: number, g: number, b: number) => {
  const clamp = (channel: number) => Math.max(0, Math.min(255, Math.round(channel)))
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g)
    .toString(16)
    .padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase()
}

const rgbaFromHexAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex)
  const clamped = clampAlpha(alpha)
  return `rgba(${r}, ${g}, ${b}, ${clamped})`
}

const mixHexColors = (colorA: string, colorB: string, ratio: number) => {
  const a = hexToRgb(colorA)
  const b = hexToRgb(colorB)
  const mixChannel = (channelA: number, channelB: number) =>
    Math.round(channelA + (channelB - channelA) * ratio)
  return `#${[mixChannel(a.r, b.r), mixChannel(a.g, b.g), mixChannel(a.b, b.b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

const parseColorString = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return { hex: '#000000', alpha: 1 }
  }

  if (trimmed.startsWith('rgba')) {
    const match = trimmed.match(/rgba?\(([^)]+)\)/i)
    if (match) {
      const [r = '0', g = '0', b = '0', a = '1'] = match[1]
        .split(',')
        .map((part) => part.trim())
      return {
        hex: rgbToHex(Number(r), Number(g), Number(b)),
        alpha: clampAlpha(Number(a)),
      }
    }
  }

  if (trimmed.startsWith('rgb')) {
    const match = trimmed.match(/rgb\(([^)]+)\)/i)
    if (match) {
      const [r = '0', g = '0', b = '0'] = match[1]
        .split(',')
        .map((part) => part.trim())
      return {
        hex: rgbToHex(Number(r), Number(g), Number(b)),
        alpha: 1,
      }
    }
  }

  if (isHex(trimmed)) {
    return { hex: normalizeHex(trimmed), alpha: 1 }
  }

  return { hex: '#000000', alpha: 1 }
}

type LavaInstance = {
  reseed: () => void
}

type LavaController = {
  greens: string[]
  accents: string[]
  instances: LavaInstance[]
  reseedAll: () => void
}

declare global {
  interface Window {
    LAVA?: LavaController
    syncLavaPaletteFromVars?: () => void
  }
}

export default function MeuPerfil() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>('')
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeState>(defaultTheme)

  const cardTopHexRef = useRef<HTMLInputElement>(null)
  const cardBottomHexRef = useRef<HTMLInputElement>(null)
  const cardBorderHexRef = useRef<HTMLInputElement>(null)
  const bgTopHexRef = useRef<HTMLInputElement>(null)
  const bgBottomHexRef = useRef<HTMLInputElement>(null)
  const glassBorderHexRef = useRef<HTMLInputElement>(null)
  const glassHexRef = useRef<HTMLInputElement>(null)
  const bubbleDarkHexRef = useRef<HTMLInputElement>(null)
  const bubbleLightHexRef = useRef<HTMLInputElement>(null)

  const commitVar = useCallback((name: string, value: string) => {
    if (typeof window === 'undefined') return
    document.documentElement.style.setProperty(name, value)
  }, [])

  const refreshLavaPalette = useCallback(() => {
    if (typeof window === 'undefined') return
    window.syncLavaPaletteFromVars?.()
  }, [])

  const syncThemeFromComputed = useCallback(() => {
    if (typeof window === 'undefined') return
    const computed = getComputedStyle(document.documentElement)
    const innerTop = parseColorString(computed.getPropertyValue('--inner-top'))
    const innerBottom = parseColorString(
      computed.getPropertyValue('--inner-bottom'),
    )
    const cardStroke = parseColorString(computed.getPropertyValue('--card-stroke'))
    const bgTop = parseColorString(computed.getPropertyValue('--bg-top'))
    const bgBottom = parseColorString(computed.getPropertyValue('--bg-bottom'))
    const glass = parseColorString(computed.getPropertyValue('--glass'))
    const glassStroke = parseColorString(
      computed.getPropertyValue('--glass-stroke'),
    )
    const bubbleDark = parseColorString(computed.getPropertyValue('--dark'))
    const bubbleLight = parseColorString(computed.getPropertyValue('--light'))
    const bubbleAlphaMin = parseFloat(
      computed.getPropertyValue('--lava-alpha-min'),
    )
    const bubbleAlphaMax = parseFloat(
      computed.getPropertyValue('--lava-alpha-max'),
    )

    setTheme({
      innerTop: innerTop.hex,
      innerBottom: innerBottom.hex,
      cardBorderHex: cardStroke.hex,
      cardBorderAlpha: clampAlpha(cardStroke.alpha),
      bgTop: bgTop.hex,
      bgBottom: bgBottom.hex,
      glassColor: glass.hex,
      glassAlpha: clampAlpha(glass.alpha),
      glassBorderHex: glassStroke.hex,
      glassBorderAlpha: clampAlpha(glassStroke.alpha),
      bubbleDark: bubbleDark.hex,
      bubbleLight: bubbleLight.hex,
      bubbleAlphaMin: Number.isFinite(bubbleAlphaMin)
        ? clampAlpha(bubbleAlphaMin)
        : defaultTheme.bubbleAlphaMin,
      bubbleAlphaMax: Number.isFinite(bubbleAlphaMax)
        ? clampAlpha(bubbleAlphaMax)
        : defaultTheme.bubbleAlphaMax,
    })
  }, [])

  useEffect(() => {
    syncThemeFromComputed()
  }, [syncThemeFromComputed])

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('force-motion')
    return () => {
      root.classList.remove('force-motion')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const cleanupFns: Array<() => void> = []
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

    const createdInstances: LavaInstance[] = []
    const lavaInstances = lavaController.instances

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

    const rand = (min: number, max: number) => min + Math.random() * (max - min)
    const pick = <T,>(values: readonly T[]) =>
      values[Math.floor(Math.random() * values.length)]

    const buildLavaPalette = () => {
      const computed = getComputedStyle(document.documentElement)
      const dark =
        parseColorString(computed.getPropertyValue('--dark')).hex ||
        defaultTheme.bubbleDark
      const light =
        parseColorString(computed.getPropertyValue('--light')).hex ||
        defaultTheme.bubbleLight
      const steps = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.85, 0.92, 0.97]
      return steps.map((step) => mixHexColors(dark, light, step))
    }

    const syncLavaPaletteFromVars = () => {
      lavaController.greens = buildLavaPalette()
      lavaController.reseedAll()
    }

    window.syncLavaPaletteFromVars = syncLavaPaletteFromVars

    const createLavaLayer = (canvasId: string, type: 'dark' | 'light') => {
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
        const computed = getComputedStyle(document.documentElement)
        const minOpacity =
          parseFloat(computed.getPropertyValue('--lava-alpha-min')) ||
          defaultTheme.bubbleAlphaMin
        const maxOpacity =
          parseFloat(computed.getPropertyValue('--lava-alpha-max')) ||
          defaultTheme.bubbleAlphaMax

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
          const projectedRadius =
            blob.r * (1 + Math.sin(state.time * 0.02 + blob.a) * 0.05)
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

      const instance: LavaInstance = { reseed }
      lavaInstances.push(instance)
      createdInstances.push(instance)

      reseed()
      tick()
    }

    lavaController.greens = buildLavaPalette()
    createLavaLayer('lavaDark', 'dark')
    createLavaLayer('lavaLight', 'light')
    syncLavaPaletteFromVars()

    return () => {
      cleanupFns.forEach((fn) => fn())
      lavaController.instances = lavaController.instances.filter(
        (instance) => !createdInstances.includes(instance),
      )
      if (lavaController.instances.length === 0 && window.LAVA === lavaController) {
        delete window.LAVA
      }
      if (window.syncLavaPaletteFromVars === syncLavaPaletteFromVars) {
        delete window.syncLavaPaletteFromVars
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(AVATAR_STORAGE_KEY)
      if (stored) {
        setAvatarDataUrl(stored)
      }
    } catch (storageError) {
      console.warn('Não foi possível carregar o avatar salvo', storageError)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadProfile() {
      setLoading(true)
      setError(null)

      const { data: sess, error: sessionError } = await supabase.auth.getSession()
      if (!active) return

      if (sessionError) {
        setError('Não foi possível carregar seus dados. Tente novamente.')
        setLoading(false)
        return
      }

      const currentSession = sess.session

      if (!currentSession) {
        router.replace('/login')
        return
      }

      setSession(currentSession)

      const { data: me, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, whatsapp, email, birth_date, role')
        .eq('id', currentSession.user.id)
        .maybeSingle()

      if (!active) return

      if (profileError) {
        setError('Não foi possível carregar seus dados. Tente novamente.')
        setProfile(null)
        setLoading(false)
        return
      }

      const role =
        me?.role === 'admin'
          ? 'admin'
          : me?.role === 'adminsuper' || me?.role === 'adminmaster'
            ? 'adminsuper'
            : 'client'

      const resolvedProfile: Profile = {
        full_name: me?.full_name ?? null,
        whatsapp: me?.whatsapp ?? null,
        email: me?.email ?? currentSession.user.email ?? null,
        birth_date: me?.birth_date ?? null,
        role,
      }

      setProfile(resolvedProfile)
      setFullName(resolvedProfile.full_name ?? '')
      setWhatsapp(resolvedProfile.whatsapp ?? '')
      setEmail(resolvedProfile.email ?? '')
      setBirthDate(resolvedProfile.birth_date ?? '')
      setLoading(false)
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [router])

  const applyCardTop = useCallback(
    (value: string) => {
      const normalized = normalizeHex(value)
      commitVar('--inner-top', normalized)
      setTheme((prev) => ({ ...prev, innerTop: normalized }))
      if (cardTopHexRef.current) {
        cardTopHexRef.current.value = normalized
      }
    },
    [commitVar],
  )

  const applyCardBottom = useCallback(
    (value: string) => {
      const normalized = normalizeHex(value)
      commitVar('--inner-bottom', normalized)
      setTheme((prev) => ({ ...prev, innerBottom: normalized }))
      if (cardBottomHexRef.current) {
        cardBottomHexRef.current.value = normalized
      }
    },
    [commitVar],
  )

  const applyCardBorder = useCallback(
    (hex: string, alpha: number) => {
      const normalized = normalizeHex(hex)
      const clamped = clampAlpha(alpha)
      commitVar('--card-stroke', rgbaFromHexAlpha(normalized, clamped))
      setTheme((prev) => ({
        ...prev,
        cardBorderHex: normalized,
        cardBorderAlpha: clamped,
      }))
      if (cardBorderHexRef.current) {
        cardBorderHexRef.current.value = normalized
      }
    },
    [commitVar],
  )

  const applyBackgroundTop = useCallback(
    (value: string) => {
      const normalized = normalizeHex(value)
      commitVar('--bg-top', normalized)
      setTheme((prev) => ({ ...prev, bgTop: normalized }))
      if (bgTopHexRef.current) {
        bgTopHexRef.current.value = normalized
      }
    },
    [commitVar],
  )

  const applyBackgroundBottom = useCallback(
    (value: string) => {
      const normalized = normalizeHex(value)
      commitVar('--bg-bottom', normalized)
      setTheme((prev) => ({ ...prev, bgBottom: normalized }))
      if (bgBottomHexRef.current) {
        bgBottomHexRef.current.value = normalized
      }
    },
    [commitVar],
  )

  const applyGlassBorder = useCallback(
    (hex: string, alpha: number) => {
      const normalized = normalizeHex(hex)
      const clamped = clampAlpha(alpha)
      commitVar('--glass-stroke', rgbaFromHexAlpha(normalized, clamped))
      setTheme((prev) => ({
        ...prev,
        glassBorderHex: normalized,
        glassBorderAlpha: clamped,
      }))
      if (glassBorderHexRef.current) {
        glassBorderHexRef.current.value = normalized
      }
    },
    [commitVar],
  )

  const applyGlass = useCallback(
    (hex: string, alpha: number) => {
      const normalized = normalizeHex(hex)
      const clamped = clampAlpha(alpha)
      commitVar('--glass', rgbaFromHexAlpha(normalized, clamped))
      setTheme((prev) => ({
        ...prev,
        glassColor: normalized,
        glassAlpha: clamped,
      }))
      if (glassHexRef.current) {
        glassHexRef.current.value = normalized
      }
    },
    [commitVar],
  )

  const applyBubbleDark = useCallback(
    (hex: string) => {
      const normalized = normalizeHex(hex)
      commitVar('--dark', normalized)
      setTheme((prev) => ({ ...prev, bubbleDark: normalized }))
      if (bubbleDarkHexRef.current) {
        bubbleDarkHexRef.current.value = normalized
      }
      refreshLavaPalette()
    },
    [commitVar, refreshLavaPalette],
  )

  const applyBubbleLight = useCallback(
    (hex: string) => {
      const normalized = normalizeHex(hex)
      commitVar('--light', normalized)
      setTheme((prev) => ({ ...prev, bubbleLight: normalized }))
      if (bubbleLightHexRef.current) {
        bubbleLightHexRef.current.value = normalized
      }
      refreshLavaPalette()
    },
    [commitVar, refreshLavaPalette],
  )

  const applyBubbleAlpha = useCallback(
    (minValue: number, maxValue: number) => {
      const min = clampAlpha(minValue)
      const max = clampAlpha(maxValue)
      const resolvedMin = max < min ? max : min
      const resolvedMax = max < min ? min : max
      commitVar('--lava-alpha-min', String(resolvedMin))
      commitVar('--lava-alpha-max', String(resolvedMax))
      setTheme((prev) => ({
        ...prev,
        bubbleAlphaMin: resolvedMin,
        bubbleAlphaMax: resolvedMax,
      }))
      refreshLavaPalette()
    },
    [commitVar, refreshLavaPalette],
  )

  const handlePaletteSwatch = useCallback(
    (css: string) => {
      const rules = css
        .split(';')
        .map((rule) => rule.trim())
        .filter(Boolean)
      rules.forEach((rule) => {
        const [prop, value] = rule.split(':')
        if (prop && value) {
          commitVar(prop.trim(), value.trim())
        }
      })
      syncThemeFromComputed()
      refreshLavaPalette()
    },
    [commitVar, refreshLavaPalette, syncThemeFromComputed],
  )

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setAvatarDataUrl(result)
        try {
          window.localStorage.setItem(AVATAR_STORAGE_KEY, result)
        } catch (storageError) {
          console.warn('Não foi possível salvar o avatar localmente', storageError)
        }
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = () => {
    setAvatarDataUrl('')
    try {
      window.localStorage.removeItem(AVATAR_STORAGE_KEY)
    } catch (storageError) {
      console.warn('Não foi possível remover o avatar local', storageError)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    if (!session?.user?.id) {
      setError('Sua sessão expirou. Entre novamente para atualizar seus dados.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const userId = session.user.id
    const normalizedEmail = email.trim()
    const updates = {
      full_name: fullName.trim() || null,
      whatsapp: whatsapp.trim() || null,
      email: normalizedEmail || null,
      birth_date: birthDate || null,
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (profileError) {
      setError('Não foi possível atualizar seus dados. Tente novamente.')
      setSaving(false)
      return
    }

    const authPayload: { email?: string; password?: string } = {}
    if (normalizedEmail && normalizedEmail !== session.user.email) {
      authPayload.email = normalizedEmail
    }
    if (password) {
      authPayload.password = password
    }

    if (Object.keys(authPayload).length > 0) {
      const { error: authError } = await supabase.auth.updateUser(authPayload)
      if (authError) {
        setError(
          authError.message ||
            'Não foi possível atualizar seus dados de acesso.',
        )
        setSaving(false)
        return
      }
    }

    const { data: refreshed } = await supabase.auth.getSession()
    if (refreshed.session) {
      setSession(refreshed.session)
    }

    const updatedProfile: Profile = {
      full_name: updates.full_name,
      whatsapp: updates.whatsapp,
      email: updates.email,
      birth_date: updates.birth_date,
      role: profile?.role ?? 'client',
    }

    setProfile(updatedProfile)
    setPassword('')
    setSuccess('Dados atualizados com sucesso.')
    setSaving(false)
  }

  const handleSignOut = async () => {
    if (signingOut) return

    setSigningOut(true)
    setSignOutError(null)

    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setSignOutError(
        signOutError.message ||
          'Não foi possível encerrar a sessão. Tente novamente.',
      )
      setSigningOut(false)
      return
    }

    router.replace('/login')
    setSigningOut(false)
  }

  const resolvedName = fullName.trim() || profile?.full_name?.trim() || ''

  const handleCardTopColor = (event: ChangeEvent<HTMLInputElement>) => {
    applyCardTop(event.target.value)
  }

  const handleCardBottomColor = (event: ChangeEvent<HTMLInputElement>) => {
    applyCardBottom(event.target.value)
  }

  const handleCardBorderColor = (event: ChangeEvent<HTMLInputElement>) => {
    applyCardBorder(event.target.value, theme.cardBorderAlpha)
  }

  const handleCardBorderAlpha = (event: ChangeEvent<HTMLInputElement>) => {
    const value = clampAlpha(Number(event.target.value))
    applyCardBorder(theme.cardBorderHex, value)
  }

  const handleBackgroundTopColor = (event: ChangeEvent<HTMLInputElement>) => {
    applyBackgroundTop(event.target.value)
  }

  const handleBackgroundBottomColor = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    applyBackgroundBottom(event.target.value)
  }

  const handleGlassBorderColor = (event: ChangeEvent<HTMLInputElement>) => {
    applyGlassBorder(event.target.value, theme.glassBorderAlpha)
  }

  const handleGlassBorderAlpha = (event: ChangeEvent<HTMLInputElement>) => {
    const value = clampAlpha(Number(event.target.value))
    applyGlassBorder(theme.glassBorderHex, value)
  }

  const handleGlassColor = (event: ChangeEvent<HTMLInputElement>) => {
    applyGlass(event.target.value, theme.glassAlpha)
  }

  const handleGlassAlpha = (event: ChangeEvent<HTMLInputElement>) => {
    const value = clampAlpha(Number(event.target.value))
    applyGlass(theme.glassColor, value)
  }

  const handleBubbleDarkColor = (event: ChangeEvent<HTMLInputElement>) => {
    applyBubbleDark(event.target.value)
  }

  const handleBubbleLightColor = (event: ChangeEvent<HTMLInputElement>) => {
    applyBubbleLight(event.target.value)
  }

  const handleBubbleAlphaMin = (event: ChangeEvent<HTMLInputElement>) => {
    const value = clampAlpha(Number(event.target.value))
    const nextMax = Math.max(value, theme.bubbleAlphaMax)
    applyBubbleAlpha(value, nextMax)
  }

  const handleBubbleAlphaMax = (event: ChangeEvent<HTMLInputElement>) => {
    const value = clampAlpha(Number(event.target.value))
    const nextMin = Math.min(value, theme.bubbleAlphaMin)
    applyBubbleAlpha(nextMin, value)
  }

  const applyHexFromRef = (
    ref: RefObject<HTMLInputElement | null>,
    apply: (value: string) => void,
  ) => {
    const value = ref.current?.value?.trim()
    if (!value || !isHex(value)) return
    apply(value)
  }

  return (
    <>
      <style jsx global>{`
        :root {
          --ink: #183f2e;
          --muted: #6a8f7f;
          --muted-2: #5f8c79;
          --bg-top: #7d9782;
          --bg-bottom: #dfe9e2;
          --glass: rgba(236, 250, 241, 0.34);
          --glass-stroke: rgba(255, 255, 255, 0.78);
          --inner-top: #f3fcf6;
          --inner-bottom: #c9e0d1;
          --shadow-xl: 0 28px 76px rgba(28, 75, 56, 0.14);
          --radius-outer: 28px;
          --radius-inner: 22px;
          --dark: #7aa98a;
          --light: #bcd6c3;
          --card-stroke: rgba(255, 255, 255, 0.3);
          --lava-alpha-min: 0.4;
          --lava-alpha-max: 0.85;
        }
        * {
          box-sizing: border-box;
        }
        html,
        body {
          height: 100%;
        }
        body {
          margin: 0;
          font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica,
            Arial, 'Apple Color Emoji', 'Segoe UI Emoji';
          font-size: 16px;
          color: var(--ink);
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
          background: radial-gradient(
            120% 120% at 10% 0%,
            var(--bg-top) 0%,
            var(--bg-bottom) 62%
          );
          background-attachment: fixed;
          overflow-x: hidden;
        }
        .texture {
          position: fixed;
          inset: -20%;
          z-index: 0;
          pointer-events: none;
          opacity: 0.22;
          mix-blend-mode: multiply;
        }
        .texture svg {
          width: 100%;
          height: 100%;
          display: block;
        }
        .lamp {
          position: fixed;
          inset: -12vh -12vw;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .lava {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
        }
        .lava.dark {
          mix-blend-mode: multiply;
          filter: blur(26px) contrast(1.05);
          background: radial-gradient(circle, var(--dark), transparent 70%);
        }
        .lava.light {
          mix-blend-mode: screen;
          filter: blur(30px) contrast(1.04);
          background: radial-gradient(circle, var(--light), transparent 70%);
        }
        .page {
          position: relative;
          min-height: 100svh;
          z-index: 1;
        }
        .center {
          min-height: 100svh;
          display: grid;
          place-items: center;
          justify-content: center;
          padding: calc(10px + env(safe-area-inset-top)) 18px
            calc(18px + env(safe-area-inset-bottom));
          position: relative;
        }
        .stack {
          display: grid;
          justify-items: center;
          gap: clamp(12px, 2.2vw, 18px);
        }
        header {
          text-align: center;
        }
        h1 {
          font-family: Fraunces, 'Playfair Display', Georgia, serif;
          font-weight: 700;
          font-size: clamp(30px, 5.4vw, 48px);
          line-height: 1.06;
          margin: 0;
          letter-spacing: -0.01em;
        }
        h1 .muted2 {
          color: var(--muted-2);
          font-style: normal;
        }
        .glass {
          width: clamp(320px, 92vw, 880px);
          display: inline-block;
          background: var(--glass);
          background-image: linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.28),
              rgba(255, 255, 255, 0) 22%
            ),
            radial-gradient(
              120% 120% at 50% -10%,
              rgba(255, 255, 255, 0.14),
              transparent 60%
            );
          border: 1.2px solid var(--glass-stroke);
          border-radius: var(--radius-outer);
          box-shadow: var(--shadow-xl);
          padding: clamp(14px, 2.6vw, 22px);
        }
        @supports (backdrop-filter: blur(18px)) or
          (-webkit-backdrop-filter: blur(18px)) {
          .glass {
            backdrop-filter: blur(18px) saturate(150%);
            -webkit-backdrop-filter: blur(18px) saturate(150%);
          }
        }
        .label {
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.22em;
          color: var(--muted);
          margin-bottom: 12px;
        }
        .profile-grid {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: clamp(12px, 2vw, 18px);
        }
        @media (max-width: 880px) {
          .profile-grid {
            grid-template-columns: 1fr;
          }
        }
        .card {
          position: relative;
          border-radius: var(--radius-inner);
          border: 1.6px solid var(--card-stroke);
          background: linear-gradient(
            180deg,
            var(--inner-top),
            var(--inner-bottom)
          );
          box-shadow: 0 14px 28px rgba(28, 75, 56, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            inset 0 -14px 20px rgba(143, 196, 170, 0.12);
          padding: 14px;
        }
        .card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          box-shadow: 0 14px 24px rgba(255, 255, 255, 0.25) inset;
          pointer-events: none;
        }
        .avatar-wrap {
          display: grid;
          place-items: center;
          gap: 12px;
        }
        .avatar {
          width: 180px;
          height: 180px;
          border-radius: 50%;
          border: 1.6px solid var(--card-stroke);
          background: linear-gradient(
            180deg,
            var(--inner-top),
            var(--inner-bottom)
          );
          box-shadow: 0 10px 20px rgba(28, 75, 56, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          overflow: hidden;
          position: relative;
        }
        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .avatar .placeholder {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: var(--muted);
        }
        .avatar-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .btn {
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.8);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn:active {
          transform: translateY(1px);
        }
        .btn.primary {
          background: rgba(31, 69, 55, 0.9);
          color: #f8fbf8;
          border-color: rgba(31, 69, 55, 0.2);
        }
        .btn.secondary {
          background: rgba(255, 255, 255, 0.75);
        }
        .fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 640px) {
          .fields {
            grid-template-columns: 1fr;
          }
        }
        .field {
          display: grid;
          gap: 6px;
        }
        .field label {
          font-size: 12px;
          letter-spacing: 0.14em;
          color: var(--muted);
          text-transform: uppercase;
        }
        .input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.9);
          padding: 10px 12px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9),
            0 8px 18px rgba(28, 75, 56, 0.06);
          font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto,
            Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji';
          font-size: 15px;
          color: var(--ink);
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          margin-top: 14px;
        }
        .status-message {
          margin-top: 16px;
          text-align: center;
          font-size: 14px;
          color: rgba(24, 63, 46, 0.8);
        }
        .alert {
          margin-top: 12px;
          border-radius: 16px;
          padding: 12px 16px;
          font-size: 14px;
        }
        .alert.error {
          border: 1px solid rgba(220, 38, 38, 0.2);
          background: rgba(254, 226, 226, 0.8);
          color: #991b1b;
        }
        .alert.success {
          border: 1px solid rgba(47, 109, 79, 0.3);
          background: rgba(247, 242, 231, 0.7);
          color: #2f6d4f;
        }
        .support-note {
          margin-top: 4px;
          text-align: center;
          font-size: 12px;
          color: rgba(31, 45, 40, 0.6);
        }
        footer {
          text-align: center;
          font-size: 12px;
          letter-spacing: 0.34em;
          color: color-mix(in srgb, var(--ink) 74%, transparent);
          border: none;
          background: transparent;
        }
        #paletteBtn {
          position: fixed;
          bottom: 22px;
          right: 22px;
          z-index: 30;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(8px) saturate(160%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          transition: 0.25s;
        }
        #paletteBtn:hover {
          transform: scale(1.06);
        }
        #paletteBtn svg {
          width: 22px;
          height: 22px;
          stroke: #183f2e;
          opacity: 0.9;
        }
        #palettePanel {
          position: fixed;
          top: 0;
          right: 0;
          width: 300px;
          height: 100%;
          transform: translate3d(110%, 0, 0);
          opacity: 0;
          pointer-events: none;
          will-change: transform, opacity;
          overflow: hidden;
          backdrop-filter: blur(18px) saturate(160%);
          background: rgba(240, 245, 240, 0.68);
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
          transition: transform 0.33s cubic-bezier(0.4, 0, 0.2, 1),
            opacity 0.2s ease-out;
          z-index: 29;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        #palettePanel.open {
          transform: translate3d(0, 0, 0);
          opacity: 1;
          pointer-events: auto;
        }
        #panelScroll {
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          height: 100%;
          padding-bottom: 72px;
        }
        .pal-section {
          border-top: 1px solid rgba(255, 255, 255, 0.6);
          padding-top: 12px;
          margin-top: 8px;
        }
        .pal-section:first-child {
          border-top: none;
          padding-top: 0;
          margin-top: 0;
        }
        .pal-section h3 {
          font-size: 13px;
          margin: 0 0 8px;
          color: #183f2e;
        }
        .pal-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .swatch {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1px solid rgba(0, 0, 0, 0.12);
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        }
        .row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin: 6px 0;
        }
        .colorpicker {
          flex: 1;
        }
        .range {
          width: 100%;
        }
        .small {
          font-size: 12px;
          color: #2a4738;
          opacity: 0.9;
        }
        .input-hex {
          flex: 1;
          min-width: 0;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.75);
        }
        .btn-mini {
          padding: 6px 10px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(6px);
          cursor: pointer;
        }
        .hr {
          height: 1px;
          background: rgba(0, 0, 0, 0.08);
          margin: 6px 0;
        }
        #saveBtn {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 16px;
          height: 44px;
          border-radius: 14px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          background: rgba(255, 255, 255, 0.8);
          box-shadow: 0 6px 22px rgba(0, 0, 0, 0.18);
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>

      <div className="texture" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <filter id="mottle" x="-50%" y="-50%" width="200%" height="200%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.02"
                numOctaves="2"
                seed="11"
                result="turb"
              />
              <feGaussianBlur stdDeviation="18" in="turb" result="blur" />
              <feBlend in="SourceGraphic" in2="blur" mode="multiply" />
            </filter>
          </defs>
          <rect
            x="0"
            y="0"
            width="100"
            height="100"
            fill="#e9f3ee"
            filter="url(#mottle)"
          />
        </svg>
      </div>
      <div className="lamp" aria-hidden="true">
        <canvas id="lavaDark" className="lava dark" />
        <canvas id="lavaLight" className="lava light" />
      </div>

      <div className="page">
        <section className="center" id="sectionPerfil" aria-label="Meu Perfil">
          <div className="stack">
            <header>
              <h1>
                Meu <span className="muted2">Perfil</span>
              </h1>
              {resolvedName ? (
                <p className="support-note">{resolvedName}</p>
              ) : null}
            </header>

            <div className="glass" aria-label="Dados do perfil">
              <div className="label">PERFIL</div>
              <form onSubmit={handleSubmit} className="profile-form">
                <div className="profile-grid">
                  <div className="card">
                    <div className="avatar-wrap">
                      <div className="avatar" id="avatarBox">
                        {avatarDataUrl ? (
                          <img src={avatarDataUrl} alt="" title="" />
                        ) : (
                          <div className="placeholder" aria-hidden="true">
                            <svg
                              width="56"
                              height="56"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                            >
                              <circle cx="12" cy="8" r="4" />
                              <path d="M4 20c2-3 5-5 8-5s6 2 8 5" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="avatar-actions">
                        <label className="btn">
                          <input
                            id="avatarInput"
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={handleAvatarChange}
                          />
                          Enviar foto
                        </label>
                        <button
                          type="button"
                          className="btn"
                          onClick={handleRemoveAvatar}
                        >
                          Remover foto
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="fields">
                      <div className="field" style={{ gridColumn: '1 / -1' }}>
                        <label htmlFor="nome">Nome</label>
                        <input
                          id="nome"
                          className="input"
                          type="text"
                          placeholder="Seu nome"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          disabled={loading || saving}
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="email">E-mail</label>
                        <input
                          id="email"
                          className="input"
                          type="email"
                          placeholder="voce@exemplo.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          disabled={loading || saving}
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="nascimento">Data de nascimento</label>
                        <input
                          id="nascimento"
                          className="input"
                          type="date"
                          value={birthDate}
                          onChange={(event) => setBirthDate(event.target.value)}
                          disabled={loading || saving}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="celular">Celular</label>
                        <input
                          id="celular"
                          className="input"
                          type="tel"
                          placeholder="(00) 00000-0000"
                          autoComplete="tel"
                          value={whatsapp}
                          onChange={(event) => setWhatsapp(event.target.value)}
                          disabled={loading || saving}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="senha">Nova senha</label>
                        <input
                          id="senha"
                          className="input"
                          type="password"
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          disabled={loading || saving}
                          minLength={6}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <p className="status-message">Carregando suas informações…</p>
                ) : null}
                {error ? <div className="alert error">{error}</div> : null}
                {success ? <div className="alert success">{success}</div> : null}
                {signOutError ? (
                  <div className="alert error">{signOutError}</div>
                ) : null}

                <div className="actions">
                  <button
                    className="btn primary"
                    type="submit"
                    disabled={saving || loading}
                  >
                    {saving ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                  >
                    {signingOut ? 'Saindo…' : 'Encerrar sessão'}
                  </button>
                </div>
              </form>
            </div>

            <footer>ROMEIKE BEAUTY</footer>
          </div>
        </section>
      </div>

      <button
        id="paletteBtn"
        type="button"
        title="Personalizar"
        onClick={() => setIsPaletteOpen((open) => !open)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="9" />
          <path d="M14.8 14.8a3 3 0 1 1-4.6-3.6" />
          <path d="M7.2 7.2l1.8 1.8" />
          <path d="M16.8 7.2l-1.8 1.8" />
        </svg>
      </button>

      <div id="palettePanel" className={isPaletteOpen ? 'open' : ''}>
        <div id="panelScroll">
          <div className="pal-section">
            <h3>Cards (livre)</h3>
            <div className="row">
              <span className="small">Superior</span>
              <input
                type="color"
                className="colorpicker"
                id="cardTop"
                value={theme.innerTop}
                onChange={handleCardTopColor}
              />
            </div>
            <div className="row">
              <span className="small">Inferior</span>
              <input
                type="color"
                className="colorpicker"
                id="cardBottom"
                value={theme.innerBottom}
                onChange={handleCardBottomColor}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="cardTopHex"
                placeholder="#RRGGBB"
                ref={cardTopHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="addCardTop"
                onClick={() => applyHexFromRef(cardTopHexRef, applyCardTop)}
              >
                Aplicar sup.
              </button>
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="cardBottomHex"
                placeholder="#RRGGBB"
                ref={cardBottomHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="addCardBottom"
                onClick={() => applyHexFromRef(cardBottomHexRef, applyCardBottom)}
              >
                Aplicar inf.
              </button>
            </div>
            <div className="row">
              <span className="small">Borda card</span>
              <input
                type="color"
                className="colorpicker"
                id="cardBorderColor"
                value={theme.cardBorderHex}
                onChange={handleCardBorderColor}
              />
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
                value={theme.cardBorderAlpha}
                onChange={handleCardBorderAlpha}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="cardBorderHex"
                placeholder="#RRGGBB"
                ref={cardBorderHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="applyCardBorderHex"
                onClick={() =>
                  applyHexFromRef(cardBorderHexRef, (value) =>
                    applyCardBorder(value, theme.cardBorderAlpha),
                  )
                }
              >
                Aplicar borda
              </button>
            </div>
          </div>

          <div className="pal-section">
            <h3>Container (fundo)</h3>
            <div className="pal-options">
              <div
                className="swatch"
                style={{ background: '#cfe6d5' }}
                onClick={() =>
                  handlePaletteSwatch(
                    '--bg-top:#cfe6d5;--bg-bottom:#eef3e6',
                  )
                }
              />
              <div
                className="swatch"
                style={{ background: '#e3e8df' }}
                onClick={() =>
                  handlePaletteSwatch(
                    '--bg-top:#e3e8df;--bg-bottom:#f2f3ef',
                  )
                }
              />
              <div
                className="swatch"
                style={{ background: '#dbece3' }}
                onClick={() =>
                  handlePaletteSwatch(
                    '--bg-top:#dbece3;--bg-bottom:#eef4ec',
                  )
                }
              />
            </div>
            <div className="row">
              <span className="small">Topo</span>
              <input
                type="color"
                className="colorpicker"
                id="bgTop"
                value={theme.bgTop}
                onChange={handleBackgroundTopColor}
              />
            </div>
            <div className="row">
              <span className="small">Base</span>
              <input
                type="color"
                className="colorpicker"
                id="bgBottom"
                value={theme.bgBottom}
                onChange={handleBackgroundBottomColor}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="bgTopHex"
                placeholder="#RRGGBB"
                ref={bgTopHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="addBgTop"
                onClick={() => applyHexFromRef(bgTopHexRef, applyBackgroundTop)}
              >
                Aplicar topo
              </button>
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="bgBottomHex"
                placeholder="#RRGGBB"
                ref={bgBottomHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="addBgBottom"
                onClick={() =>
                  applyHexFromRef(bgBottomHexRef, applyBackgroundBottom)
                }
              >
                Aplicar base
              </button>
            </div>
            <div className="hr" />
            <div className="row">
              <span className="small">Borda vidro</span>
              <input
                type="color"
                className="colorpicker"
                id="glassBorderColor"
                value={theme.glassBorderHex}
                onChange={handleGlassBorderColor}
              />
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
                value={theme.glassBorderAlpha}
                onChange={handleGlassBorderAlpha}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="glassBorderHex"
                placeholder="#RRGGBB"
                ref={glassBorderHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="applyGlassBorderHex"
                onClick={() =>
                  applyHexFromRef(glassBorderHexRef, (value) =>
                    applyGlassBorder(value, theme.glassBorderAlpha),
                  )
                }
              >
                Aplicar borda
              </button>
            </div>
          </div>

          <div className="pal-section">
            <h3>Overlay (vidro)</h3>
            <div className="pal-options">
              <div
                className="swatch"
                style={{ background: 'rgba(236,250,241,.34)' }}
                onClick={() => handlePaletteSwatch('--glass:rgba(236,250,241,.34)')}
              />
              <div
                className="swatch"
                style={{ background: 'rgba(240,245,240,.42)' }}
                onClick={() => handlePaletteSwatch('--glass:rgba(240,245,240,.42)')}
              />
              <div
                className="swatch"
                style={{ background: 'rgba(230,240,235,.50)' }}
                onClick={() => handlePaletteSwatch('--glass:rgba(230,240,235,.50)')}
              />
            </div>
            <div className="row">
              <span className="small">Cor</span>
              <input
                type="color"
                className="colorpicker"
                id="glassColor"
                value={theme.glassColor}
                onChange={handleGlassColor}
              />
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
                value={theme.glassAlpha}
                onChange={handleGlassAlpha}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="glassHex"
                placeholder="#RRGGBB"
                ref={glassHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="applyGlassHex"
                onClick={() => applyHexFromRef(glassHexRef, (value) => applyGlass(value, theme.glassAlpha))}
              >
                Aplicar cor
              </button>
            </div>
          </div>

          <div className="pal-section">
            <h3>Bolhas</h3>
            <div className="pal-options">
              <div
                className="swatch"
                style={{ background: '#7aa98a' }}
                onClick={() =>
                  handlePaletteSwatch(
                    '--dark:#7aa98a;--light:#bcd6c3',
                  )
                }
              />
              <div
                className="swatch"
                style={{ background: '#86b79c' }}
                onClick={() =>
                  handlePaletteSwatch(
                    '--dark:#86b79c;--light:#cae0cf',
                  )
                }
              />
              <div
                className="swatch"
                style={{ background: '#9ccbb1' }}
                onClick={() =>
                  handlePaletteSwatch(
                    '--dark:#9ccbb1;--light:#d7ede1',
                  )
                }
              />
            </div>
            <div className="row">
              <span className="small">Escura</span>
              <input
                type="color"
                className="colorpicker"
                id="bubbleDark"
                value={theme.bubbleDark}
                onChange={handleBubbleDarkColor}
              />
            </div>
            <div className="row">
              <span className="small">Clara</span>
              <input
                type="color"
                className="colorpicker"
                id="bubbleLight"
                value={theme.bubbleLight}
                onChange={handleBubbleLightColor}
              />
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
                value={theme.bubbleAlphaMin}
                onChange={handleBubbleAlphaMin}
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
                value={theme.bubbleAlphaMax}
                onChange={handleBubbleAlphaMax}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="bubbleDarkHex"
                placeholder="#RRGGBB"
                ref={bubbleDarkHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="applyBubbleDark"
                onClick={() =>
                  applyHexFromRef(bubbleDarkHexRef, applyBubbleDark)
                }
              >
                Aplicar escura
              </button>
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="bubbleLightHex"
                placeholder="#RRGGBB"
                ref={bubbleLightHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="applyBubbleLight"
                onClick={() =>
                  applyHexFromRef(bubbleLightHexRef, applyBubbleLight)
                }
              >
                Aplicar clara
              </button>
            </div>
          </div>
        </div>
        <button id="saveBtn" type="button" onClick={() => setIsPaletteOpen(false)}>
          Fechar painel
        </button>
      </div>
    </>
  )
}
