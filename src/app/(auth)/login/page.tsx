'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import { PROCEDIMENTO_CSS } from '@/lib/procedimentoTheme'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

type Rgb = { r: number; g: number; b: number }

const hexToRgb = (hex: string): Rgb => {
  const raw = hex.replace('#', '')
  const normalized = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw
  const value = parseInt(normalized, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

const mixHexColors = (colorA: string, colorB: string, ratio: number): string => {
  const a = hexToRgb(colorA)
  const b = hexToRgb(colorB)
  const mix = (channelA: number, channelB: number) => Math.round(channelA + (channelB - channelA) * ratio)
  return `#${[mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()

  const redirectByRole = useCallback(
    async (session: Session | null) => {
      if (!session?.user?.id) return

      router.replace('/meu-perfil')
    },
    [router],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const body = document.body
    body.classList.add('procedimento-screen')

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2)

    const LAVA_CONFIG = {
      dark: { count: 22, radius: [90, 150] as [number, number], speed: 1.2 },
      light: { count: 18, radius: [80, 130] as [number, number], speed: 1.0 },
    }

    const steps = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.85, 0.92, 0.97]

    const buildPalette = () => {
      const style = getComputedStyle(document.documentElement)
      const dark = style.getPropertyValue('--dark').trim() || '#7aa98a'
      const light = style.getPropertyValue('--light').trim() || '#bcd6c3'
      return steps.map((step) => mixHexColors(dark, light, step))
    }

    const palette = buildPalette()

    const rand = (min: number, max: number) => min + Math.random() * (max - min)
    const pick = <T,>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)]

    const cleanups: Array<() => void> = []

    const createLayer = (canvasId: string, type: 'dark' | 'light') => {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return

      const state = {
        width: 0,
        height: 0,
        blobs: [] as Array<{
          x: number
          y: number
          r: number
          a: number
          vx: number
          vy: number
          color: string
          opacity: number
        }>,
        raf: 0,
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
            color: pick(palette),
            opacity: rand(minOpacity, maxOpacity),
          })
        }
      }

      const tick = () => {
        if (state.destroyed) return
        context.clearRect(0, 0, state.width, state.height)
        context.globalCompositeOperation = 'lighter'
        for (const blob of state.blobs) {
          blob.x += blob.vx
          blob.y += blob.vy
          const bounds = 200 * devicePixelRatio
          if (blob.x < -bounds || blob.x > state.width + bounds) blob.vx *= -1
          if (blob.y < -bounds || blob.y > state.height + bounds) blob.vy *= -1
          const projectedRadius = blob.r * (1 + Math.sin(blob.a + performance.now() * 0.002) * 0.05)
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
      cleanups.push(() => window.removeEventListener('resize', resizeHandler))
      cleanups.push(() => {
        state.destroyed = true
        if (state.raf) window.cancelAnimationFrame(state.raf)
      })

      reseed()
      tick()
    }

    createLayer('lavaDark', 'dark')
    createLayer('lavaLight', 'light')

    return () => {
      body.classList.remove('procedimento-screen')
      cleanups.forEach((fn) => fn())
    }
  }, [])

  useEffect(() => {
    let active = true

    async function verifySession() {
      const { data } = await supabase.auth.getSession()
      if (!active) return

      if (data.session) {
        redirectByRole(data.session)
        return
      }

      setCheckingSession(false)
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session) {
        redirectByRole(session)
      } else {
        setCheckingSession(false)
      }
    })

    verifySession()

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [redirectByRole])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setMsg('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMsg(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      await redirectByRole(data.session)
    } else {
      setMsg('Sessão não disponível. Verifique seu acesso e tente novamente.')
    }

    setLoading(false)
  }

  const cardContent = checkingSession ? (
    <div className="text-center text-sm text-[color:rgba(31,45,40,0.8)]">Verificando sessão…</div>
  ) : (
    <>
      <div className="space-y-2 text-center">
        <span className="badge inline-flex">Bem-vinda de volta</span>
        <h1 className="text-3xl font-semibold text-[#1f2d28]">Acessar conta</h1>
        <p className="muted-text">
          Entre para acompanhar seus agendamentos e garantir uma rotina mais tranquila.
        </p>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1 text-left">
          <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            className="input-field"
            placeholder="nome@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-1 text-left">
          <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            className="input-field"
            type="password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      {msg && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
          {msg}
        </div>
      )}
    </>
  )

  return (
    <main className="min-h-screen flex-1">
      <Script id="procedimento-body-class" strategy="beforeInteractive">
        {"document.body.classList.add('procedimento-screen');"}
      </Script>
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
          <section className="center">
            <div className="card w-full max-w-md space-y-6 bg-white/90">
              {cardContent}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
