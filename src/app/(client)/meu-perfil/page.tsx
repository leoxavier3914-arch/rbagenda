'use client'

import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { REVEAL_STAGE, useLavaRevealStage } from '@/lib/useLavaRevealStage'
import { useLavaLamp } from '@/components/LavaLampProvider'
import {
  ClientGlassPanel,
  ClientPageShell,
  ClientSection,
} from '@/components/client/ClientPageLayout'
import { useClientPageReady } from '@/hooks/useClientPageReady'
import { useClientSessionGuard } from '@/hooks/useClientSessionGuard'
import { useProfileForm } from './useProfileForm'
import {
  AvatarUploader,
  ProfileForm,
  ProfileHeader,
  type ProfileSection,
  ThemePreferencesPanel,
} from './@components'
import { defaultTheme, type ThemeState } from './types'
import styles from './meu-perfil.module.css'

const AVATAR_STORAGE_KEY = 'rb_meu_perfil_avatar'
const BODY_LOCK_CLASS = 'meu-perfil-lock'

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

export default function MeuPerfilPage() {
  const {
    profile,
    fullName,
    setFullName,
    email,
    setEmail,
    whatsapp,
    setWhatsapp,
    birthDate,
    setBirthDate,
    password,
    setPassword,
    loading,
    saving,
    error,
    success,
    isDirty,
    handleSubmit,
  } = useProfileForm()
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>('')
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeState>(defaultTheme)
  const heroReady = useClientPageReady()
  useClientSessionGuard()
  const revealStage = useLavaRevealStage()
  const { refreshPalette } = useLavaLamp()
  const [activeSection, setActiveSection] = useState<ProfileSection>('dados')
  const tabRefs = useRef<Record<ProfileSection, HTMLButtonElement | null>>({
    dados: null,
    seguranca: null,
    temas: null,
    notificacoes: null,
  })

  useEffect(() => {
    document.documentElement.classList.add(BODY_LOCK_CLASS)
    document.body.classList.add(BODY_LOCK_CLASS)

    return () => {
      document.documentElement.classList.remove(BODY_LOCK_CLASS)
      document.body.classList.remove(BODY_LOCK_CLASS)
    }
  }, [])

  const canEditAppearance =
    profile?.role === 'admin' ||
    profile?.role === 'adminsuper' ||
    profile?.role === 'adminmaster'

  const handleSectionChange = (section: ProfileSection) => {
    setActiveSection(section)
    requestAnimationFrame(() => {
      tabRefs.current[section]?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    })
  }

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
    <div className={styles.pageRoot}>
      <ClientPageShell heroReady={heroReady} className={styles.wrapper} forceMotion>
        <ClientSection id="sectionPerfil" aria-label="Meu Perfil">
          <ClientGlassPanel
            className={`${styles.profileCard} ${styles.revealSeq} ${styles.revealContent}`}
            aria-label="Dados do perfil"
            data-visible={revealStage >= REVEAL_STAGE.CONTENT}
          >
            <ProfileHeader
              revealStage={revealStage}
              resolvedName={resolvedName}
              avatarSlot={
                <AvatarUploader
                  avatarDataUrl={avatarDataUrl}
                  resolvedName={resolvedName}
                  showName={false}
                  isAvatarMenuOpen={isAvatarMenuOpen}
                  avatarBoxRef={avatarBoxRef}
                  avatarActionsRef={avatarActionsRef}
                  avatarInputRef={avatarInputRef}
                  onToggle={toggleAvatarMenu}
                  onKeyDown={handleAvatarKeyDown}
                  onChange={handleAvatarChange}
                  onRemove={handleRemoveAvatar}
                />
              }
            />
            <div className={styles.profileBody}>
              <div
                className={styles.sectionTabs}
                role="tablist"
                aria-label="Seções do perfil"
              >
                <button
                  type="button"
                  className={styles.sectionBadge}
                  data-active={activeSection === 'dados'}
                  ref={(node) => {
                    tabRefs.current.dados = node
                  }}
                  onClick={() => handleSectionChange('dados')}
                >
                  Dados pessoais
                </button>
                <button
                  type="button"
                  className={styles.sectionBadge}
                  data-active={activeSection === 'seguranca'}
                  ref={(node) => {
                    tabRefs.current.seguranca = node
                  }}
                  onClick={() => handleSectionChange('seguranca')}
                >
                  Segurança
                </button>
                <button
                  type="button"
                  className={styles.sectionBadge}
                  data-active={activeSection === 'temas'}
                  ref={(node) => {
                    tabRefs.current.temas = node
                  }}
                  onClick={() => handleSectionChange('temas')}
                >
                  Temas
                </button>
                <button
                  type="button"
                  className={styles.sectionBadge}
                  data-active={activeSection === 'notificacoes'}
                  ref={(node) => {
                    tabRefs.current.notificacoes = node
                  }}
                  onClick={() => handleSectionChange('notificacoes')}
                >
                  Notificações
                </button>
              </div>
              <div className={styles.contentScroll}>
                <form onSubmit={handleSubmit} className={styles.profileForm}>
                  <div className={styles.profileGrid}>
                    <ProfileForm
                      activeSection={activeSection}
                      fullName={fullName}
                      email={email}
                      whatsapp={whatsapp}
                      birthDate={birthDate}
                      password={password}
                      loading={loading}
                      saving={saving}
                      error={error}
                      success={success}
                      isDirty={isDirty}
                      onFullNameChange={setFullName}
                      onEmailChange={setEmail}
                      onWhatsappChange={setWhatsapp}
                      onBirthDateChange={setBirthDate}
                      onPasswordChange={setPassword}
                    />
                  </div>
                </form>
              </div>
            </div>
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
    </div>
  )
}
