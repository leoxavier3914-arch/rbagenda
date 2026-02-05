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

    const updateViewport = () => {
      const visual = window.visualViewport
      if (!visual) {
        target.style.setProperty('--procedimento-vv-height', '100svh')
        target.style.setProperty('--procedimento-vv-offset', '0px')
        return
      }

      target.style.setProperty('--procedimento-vv-height', `${Math.round(visual.height)}px`)
      target.style.setProperty('--procedimento-vv-offset', `${Math.round(visual.offsetTop || 0)}px`)
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('scroll', updateViewport)

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.visualViewport?.removeEventListener('resize', updateViewport)
      window.visualViewport?.removeEventListener('scroll', updateViewport)
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
