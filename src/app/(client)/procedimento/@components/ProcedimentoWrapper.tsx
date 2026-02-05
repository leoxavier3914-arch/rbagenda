import { type ReactNode, useLayoutEffect } from 'react'

import { ClientPageShell } from '@/components/client/ClientPageLayout'

import styles from '../procedimento.module.css'

type ProcedimentoWrapperProps = {
  heroReady: boolean
  children: ReactNode
}

export function ProcedimentoWrapper({ heroReady, children }: ProcedimentoWrapperProps) {
  const wrapperClassName = `${styles.wrapper} ${heroReady ? styles.heroReady : ''}`

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

  return (
    <ClientPageShell
      heroReady={heroReady}
      className={wrapperClassName}
      forceMotion
      respectNoMotionHash
    >
      <section className={styles.viewport}>
        <div className={styles.page}>{children}</div>
      </section>
    </ClientPageShell>
  )
}
