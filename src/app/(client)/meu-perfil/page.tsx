'use client'
/* eslint-disable @next/next/no-img-element */

import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import styles from './meu-perfil.module.css'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/db'
import { REVEAL_STAGE, useLavaRevealStage } from '@/lib/useLavaRevealStage'
import { useLavaLamp } from '@/components/LavaLampProvider'

type Profile = {
  full_name: string | null
  whatsapp: string | null
  email: string | null
  birth_date: string | null
  role?: 'admin' | 'adminsuper' | 'adminmaster' | 'client'
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
  innerTop: '#EAF7EF',
  innerBottom: '#DAEFE2',
  cardBorderHex: '#FFFFFF',
  cardBorderAlpha: 0.86,
  bgTop: '#CFE6D5',
  bgBottom: '#EEF3E6',
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

const isThemeEqual = (a: ThemeState, b: ThemeState) =>
  a.innerTop === b.innerTop &&
  a.innerBottom === b.innerBottom &&
  a.cardBorderHex === b.cardBorderHex &&
  a.cardBorderAlpha === b.cardBorderAlpha &&
  a.bgTop === b.bgTop &&
  a.bgBottom === b.bgBottom &&
  a.glassColor === b.glassColor &&
  a.glassAlpha === b.glassAlpha &&
  a.glassBorderHex === b.glassBorderHex &&
  a.glassBorderAlpha === b.glassBorderAlpha &&
  a.bubbleDark === b.bubbleDark &&
  a.bubbleLight === b.bubbleLight &&
  a.bubbleAlphaMin === b.bubbleAlphaMin &&
  a.bubbleAlphaMax === b.bubbleAlphaMax

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
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeState>(defaultTheme)
  const [heroReady, setHeroReady] = useState(false)
  const revealStage = useLavaRevealStage()
  const { refreshPalette } = useLavaLamp()

  const canEditAppearance =
    profile?.role === 'admin' ||
    profile?.role === 'adminsuper' ||
    profile?.role === 'adminmaster'

  const cardTopHexRef = useRef<HTMLInputElement>(null)
  const cardBottomHexRef = useRef<HTMLInputElement>(null)
  const cardBorderHexRef = useRef<HTMLInputElement>(null)
  const bgTopHexRef = useRef<HTMLInputElement>(null)
  const bgBottomHexRef = useRef<HTMLInputElement>(null)
  const glassBorderHexRef = useRef<HTMLInputElement>(null)
  const glassHexRef = useRef<HTMLInputElement>(null)
  const bubbleDarkHexRef = useRef<HTMLInputElement>(null)
  const bubbleLightHexRef = useRef<HTMLInputElement>(null)
  const avatarBoxRef = useRef<HTMLDivElement>(null)
  const avatarActionsRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const lastSyncedThemeRef = useRef<ThemeState | null>(null)

  const commitVar = useCallback((name: string, value: string) => {
    if (typeof window === 'undefined') return
    document.documentElement.style.setProperty(name, value)
  }, [])

  const refreshLavaPalette = useCallback(() => {
    refreshPalette()
  }, [refreshPalette])

  const syncThemeFromComputed = useCallback(() => {
    if (typeof window === 'undefined') return null
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

    return {
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
    }
  }, [])

  useEffect(() => {
    const computedTheme = syncThemeFromComputed()
    if (!computedTheme) return

    setTheme((previous) => (isThemeEqual(previous, computedTheme) ? previous : computedTheme))

    if (!lastSyncedThemeRef.current) {
      lastSyncedThemeRef.current = computedTheme
      return
    }

    if (!isThemeEqual(lastSyncedThemeRef.current, computedTheme)) {
      lastSyncedThemeRef.current = computedTheme
      refreshPalette()
    }
  }, [refreshPalette, syncThemeFromComputed])

  useEffect(() => {
    setHeroReady(true)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('force-motion')

    return () => {
      root.classList.remove('force-motion')
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
    if (!canEditAppearance) {
      setIsPaletteOpen(false)
    }
  }, [canEditAppearance])

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

      if (profileError || !me) {
        setError('Não foi possível carregar seus dados. Tente novamente.')
        setLoading(false)
        return
      }

      setProfile(me)
      setFullName(me.full_name ?? '')
      setEmail(me.email ?? '')
      setWhatsapp(me.whatsapp ?? '')
      setBirthDate(me.birth_date ?? '')
      setLoading(false)
    }

    loadProfile()

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

  const resolvedName = fullName.trim() || profile?.full_name?.trim() || ''

  const toggleAvatarMenu = () => {
    setIsAvatarMenuOpen((prev) => !prev)
  }

  const handleAvatarKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleAvatarMenu()
    }
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setIsAvatarMenuOpen(false)
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setAvatarDataUrl(dataUrl)
      try {
        window.localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl)
      } catch (storageError) {
        console.warn('Não foi possível salvar o avatar', storageError)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = () => {
    setAvatarDataUrl('')
    setIsAvatarMenuOpen(false)
    try {
      window.localStorage.removeItem(AVATAR_STORAGE_KEY)
    } catch (storageError) {
      console.warn('Não foi possível remover o avatar salvo', storageError)
    }
  }

  useEffect(() => {
    if (!isAvatarMenuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      if (
        avatarBoxRef.current?.contains(target) ||
        avatarActionsRef.current?.contains(target)
      ) {
        return
      }
      setIsAvatarMenuOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAvatarMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isAvatarMenuOpen])

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
    <main
      className={`client-hero-wrapper ${heroReady ? 'client-hero-ready' : ''} ${styles.wrapper}`}
    >
      <div className="page">
        <section className="center" id="sectionPerfil" aria-label="Meu Perfil">
          <div className="stack">
            <header
              className={`${styles.revealSeq} ${styles.revealTitle}`}
              data-visible={revealStage >= REVEAL_STAGE.TITLE}
            >
              <h1>
                Meu <span className="muted2">Perfil</span>
              </h1>
            </header>

            <div
              className={`glass ${styles.profileCard} ${styles.revealSeq} ${styles.revealContent}`}
              aria-label="Dados do perfil"
              data-visible={revealStage >= REVEAL_STAGE.CONTENT}
            >
              <div
                className={`label ${styles.revealSeq} ${styles.revealDescription}`}
                data-visible={revealStage >= REVEAL_STAGE.DESCRIPTION}
              >
                PERFIL
              </div>
              <form onSubmit={handleSubmit} className="profile-form">
                <div className={styles.profileGrid}>
                  <div className={styles.avatarColumn}>
                    <div className={styles.avatarWrap}>
                      <div
                        className={styles.avatar}
                        id="avatarBox"
                        ref={avatarBoxRef}
                        onClick={toggleAvatarMenu}
                        onKeyDown={handleAvatarKeyDown}
                        tabIndex={0}
                        role="button"
                        aria-label="Abrir ações do avatar"
                        aria-expanded={isAvatarMenuOpen}
                        aria-controls="avatarActions"
                      >
                        {avatarDataUrl ? (
                          <img src={avatarDataUrl} alt="" title="" />
                        ) : (
                          <div className={styles.avatarPlaceholder} aria-hidden="true">
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
                        <div
                          className={styles.avatarActionsOverlay}
                          data-open={isAvatarMenuOpen}
                        >
                          <div
                            className={styles.avatarActions}
                            id="avatarActions"
                            ref={avatarActionsRef}
                          >
                            <label className={styles.btn}>
                              <input
                                id="avatarInput"
                                type="file"
                                accept="image/*"
                                hidden
                                ref={avatarInputRef}
                                onChange={handleAvatarChange}
                              />
                              Enviar foto
                            </label>
                            <button
                              type="button"
                              className={styles.btn}
                              onClick={handleRemoveAvatar}
                            >
                              Remover foto
                            </button>
                          </div>
                        </div>
                      </div>
                      {resolvedName ? (
                        <p className={styles.profileName}>{resolvedName}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.fieldsColumn}>
                    <div className={styles.fields}>
                      <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                        <label htmlFor="nome">Nome</label>
                        <input
                          id="nome"
                          className={styles.input}
                          type="text"
                          placeholder="Seu nome"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          disabled={loading || saving}
                          required
                        />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="email">E-mail</label>
                        <input
                          id="email"
                          className={styles.input}
                          type="email"
                          placeholder="voce@exemplo.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          disabled={loading || saving}
                          required
                        />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="nascimento">Data de nascimento</label>
                        <input
                          id="nascimento"
                          className={styles.input}
                          type="date"
                          value={birthDate}
                          onChange={(event) => setBirthDate(event.target.value)}
                          disabled={loading || saving}
                        />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="whatsapp">WhatsApp</label>
                        <input
                          id="whatsapp"
                          className={styles.input}
                          type="tel"
                          placeholder="(11) 99999-9999"
                          value={whatsapp}
                          onChange={(event) => setWhatsapp(event.target.value)}
                          disabled={loading || saving}
                        />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="senha">Atualizar senha</label>
                        <input
                          id="senha"
                          className={styles.input}
                          type="password"
                          placeholder="Deixe em branco para manter"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          disabled={loading || saving}
                        />
                      </div>
                    </div>

                    {loading ? (
                      <p className={styles.statusMessage}>Carregando suas informações…</p>
                    ) : null}
                    {error ? <div className={`${styles.alert} ${styles.error}`}>{error}</div> : null}
                    {success ? <div className={`${styles.alert} ${styles.success}`}>{success}</div> : null}
                    {signOutError ? (
                      <div className={`${styles.alert} ${styles.error}`}>{signOutError}</div>
                    ) : null}

                    <div className={styles.actions}>
                      <button
                        className={`${styles.btn} ${styles.primary}`}
                        type="submit"
                        disabled={saving || loading}
                      >
                        {saving ? 'Salvando…' : 'Salvar alterações'}
                      </button>
                      <button
                        className={`${styles.btn} ${styles.secondary}`}
                        type="button"
                        onClick={handleSignOut}
                        disabled={signingOut}
                      >
                        {signingOut ? 'Saindo…' : 'Encerrar sessão'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <footer
              className={`${styles.revealSeq} ${styles.revealContent}`}
              data-visible={revealStage >= REVEAL_STAGE.CONTENT}
            >
              ROMEIKE BEAUTY
            </footer>
          </div>
        </section>
      </div>

      {canEditAppearance ? (
        <>
          <button
            id="paletteBtn"
            type="button"
            title="Personalizar"
            onClick={() => setIsPaletteOpen((open) => !open)}
            className={`${styles.revealSeq} ${styles.revealContent}`}
            data-visible={revealStage >= REVEAL_STAGE.CONTENT}
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
            className={`${isPaletteOpen ? 'open' : ''} ${styles.revealSeq} ${styles.revealContent}`}
            data-visible={revealStage >= REVEAL_STAGE.CONTENT}
          >
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
      ) : null}
    </main>
  )
}
