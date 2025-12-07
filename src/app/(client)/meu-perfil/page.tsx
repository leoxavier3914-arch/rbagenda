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
import {
  ClientGlassPanel,
  ClientPageShell,
  ClientSection,
} from '@/components/client/ClientPageLayout'
import {
  AvatarUploader,
  ProfileForm,
  ProfileHeader,
  ThemePreferencesPanel,
} from './@components'
import { defaultTheme, type Profile, type ThemeState } from './types'

const AVATAR_STORAGE_KEY = 'rb_meu_perfil_avatar'

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
    <ClientPageShell heroReady={heroReady} className={styles.wrapper}>
      <ClientSection id="sectionPerfil" aria-label="Meu Perfil">
        <ProfileHeader revealStage={revealStage} />

        <ClientGlassPanel
          className={`${styles.profileCard} ${styles.revealSeq} ${styles.revealContent}`}
          aria-label="Dados do perfil"
          data-visible={revealStage >= REVEAL_STAGE.CONTENT}
          label="PERFIL"
          labelProps={{
            className: `${styles.revealSeq} ${styles.revealDescription}`,
            'data-visible': revealStage >= REVEAL_STAGE.DESCRIPTION,
          }}
        >
          <form onSubmit={handleSubmit} className="profile-form">
            <div className={styles.profileGrid}>
              <div className={styles.avatarColumn}>
                <AvatarUploader
                  avatarDataUrl={avatarDataUrl}
                  resolvedName={resolvedName}
                  isAvatarMenuOpen={isAvatarMenuOpen}
                  avatarBoxRef={avatarBoxRef}
                  avatarActionsRef={avatarActionsRef}
                  avatarInputRef={avatarInputRef}
                  onToggle={toggleAvatarMenu}
                  onKeyDown={handleAvatarKeyDown}
                  onChange={handleAvatarChange}
                  onRemove={handleRemoveAvatar}
                />
              </div>

              <ProfileForm
                fullName={fullName}
                email={email}
                whatsapp={whatsapp}
                birthDate={birthDate}
                password={password}
                loading={loading}
                saving={saving}
                signingOut={signingOut}
                error={error}
                success={success}
                signOutError={signOutError}
                onFullNameChange={setFullName}
                onEmailChange={setEmail}
                onWhatsappChange={setWhatsapp}
                onBirthDateChange={setBirthDate}
                onPasswordChange={setPassword}
                onSignOut={handleSignOut}
              />
            </div>
          </form>
        </ClientGlassPanel>

        <footer
          className={`${styles.revealSeq} ${styles.revealContent}`}
          data-visible={revealStage >= REVEAL_STAGE.CONTENT}
        >
          ROMEIKE BEAUTY
        </footer>
      </ClientSection>

      <ThemePreferencesPanel
        theme={theme}
        isPaletteOpen={isPaletteOpen}
        revealStage={revealStage}
        canEditAppearance={canEditAppearance}
        onToggle={() => setIsPaletteOpen((open) => !open)}
        onClose={() => setIsPaletteOpen(false)}
        onPaletteSwatch={handlePaletteSwatch}
        handleCardTopColor={handleCardTopColor}
        handleCardBottomColor={handleCardBottomColor}
        handleCardBorderColor={handleCardBorderColor}
        handleCardBorderAlpha={handleCardBorderAlpha}
        handleBackgroundTopColor={handleBackgroundTopColor}
        handleBackgroundBottomColor={handleBackgroundBottomColor}
        handleGlassBorderColor={handleGlassBorderColor}
        handleGlassBorderAlpha={handleGlassBorderAlpha}
        handleGlassColor={handleGlassColor}
        handleGlassAlpha={handleGlassAlpha}
        handleBubbleDarkColor={handleBubbleDarkColor}
        handleBubbleLightColor={handleBubbleLightColor}
        handleBubbleAlphaMin={handleBubbleAlphaMin}
        handleBubbleAlphaMax={handleBubbleAlphaMax}
        applyHexFromRef={applyHexFromRef}
        applyCardTop={applyCardTop}
        applyCardBottom={applyCardBottom}
        applyCardBorder={applyCardBorder}
        applyBackgroundTop={applyBackgroundTop}
        applyBackgroundBottom={applyBackgroundBottom}
        applyGlassBorder={applyGlassBorder}
        applyGlass={applyGlass}
        applyBubbleDark={applyBubbleDark}
        applyBubbleLight={applyBubbleLight}
        cardTopHexRef={cardTopHexRef}
        cardBottomHexRef={cardBottomHexRef}
        cardBorderHexRef={cardBorderHexRef}
        bgTopHexRef={bgTopHexRef}
        bgBottomHexRef={bgBottomHexRef}
        glassBorderHexRef={glassBorderHexRef}
        glassHexRef={glassHexRef}
        bubbleDarkHexRef={bubbleDarkHexRef}
        bubbleLightHexRef={bubbleLightHexRef}
      />
    </ClientPageShell>
  )
}

