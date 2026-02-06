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
    const target = document.documentElement
    if (!target) return

    const updateViewport = () => {
      const visual = window.visualViewport
      if (!visual) {
        target.style.setProperty('--procedimento-vv-height', '100svh')
        target.style.setProperty('--procedimento-vv-offset', '0px')
        return
      }

      const height = Math.round(visual.height)
      const offsetTop = Math.max(0, Math.round(visual.offsetTop || 0))
      target.style.setProperty('--procedimento-vv-height', `${height}px`)
      target.style.setProperty('--procedimento-vv-offset', `${offsetTop}px`)
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('scroll', updateViewport)

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.visualViewport?.removeEventListener('resize', updateViewport)
      window.visualViewport?.removeEventListener('scroll', updateViewport)
      target.style.removeProperty('--procedimento-vv-height')
      target.style.removeProperty('--procedimento-vv-offset')
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
