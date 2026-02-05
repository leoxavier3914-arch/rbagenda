import { type ReactNode, useLayoutEffect, useRef } from 'react'

import { ClientPageShell } from '@/components/client/ClientPageLayout'

import styles from '../procedimento.module.css'

type ProcedimentoWrapperProps = {
  heroReady: boolean
  children: ReactNode
}

export function ProcedimentoWrapper({ heroReady, children }: ProcedimentoWrapperProps) {
  const wrapperClassName = `${styles.wrapper} ${heroReady ? styles.heroReady : ''}`
  const viewportRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const body = document.body
    const root = document.documentElement
    body.classList.add('procedimento-no-scroll')
    root.classList.add('procedimento-no-scroll')

    return () => {
      body.classList.remove('procedimento-no-scroll')
      root.classList.remove('procedimento-no-scroll')
    }
  }, [])

  useLayoutEffect(() => {
    const target = viewportRef.current
    if (!target) return

    const updateOffset = () => {
      const visual = window.visualViewport
      if (!visual) {
        target.style.setProperty('--procedimento-center-offset', '0px')
        return
      }

      const layoutHeight = window.innerHeight
      const visualHeight = visual.height
      const offsetTop = visual.offsetTop || 0
      const centerDelta = (visualHeight - layoutHeight) / 2 + offsetTop
      const clamped = Math.max(-40, Math.min(40, Math.round(centerDelta)))

      target.style.setProperty('--procedimento-center-offset', `${clamped}px`)
    }

    updateOffset()
    window.addEventListener('resize', updateOffset)
    window.visualViewport?.addEventListener('resize', updateOffset)
    window.visualViewport?.addEventListener('scroll', updateOffset)

    return () => {
      window.removeEventListener('resize', updateOffset)
      window.visualViewport?.removeEventListener('resize', updateOffset)
      window.visualViewport?.removeEventListener('scroll', updateOffset)
    }
  }, [])

  return (
    <ClientPageShell
      heroReady={heroReady}
      className={wrapperClassName}
      forceMotion
      respectNoMotionHash
    >
      <section ref={viewportRef} className={styles.viewport}>
        <div className={styles.page}>{children}</div>
      </section>
    </ClientPageShell>
  )
}
