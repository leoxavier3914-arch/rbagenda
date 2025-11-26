import { useEffect, useState } from 'react'

export const REVEAL_STAGE = {
  LAMP: 0,
  TITLE: 1,
  DESCRIPTION: 2,
  CONTENT: 3,
} as const

export type RevealStage = (typeof REVEAL_STAGE)[keyof typeof REVEAL_STAGE]

const STAGE_ORDER: Record<RevealStage, number> = {
  [REVEAL_STAGE.LAMP]: 0,
  [REVEAL_STAGE.TITLE]: 1,
  [REVEAL_STAGE.DESCRIPTION]: 2,
  [REVEAL_STAGE.CONTENT]: 3,
}

const scheduleStageUpdate = (target: RevealStage, delay: number, setStage: (stage: RevealStage) => void) =>
  window.setTimeout(() => {
    setStage((current) => (STAGE_ORDER[target] > STAGE_ORDER[current] ? target : current))
  }, delay)

export function useLavaRevealStage(): RevealStage {
  const [stage, setStage] = useState<RevealStage>(REVEAL_STAGE.LAMP)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      setStage(REVEAL_STAGE.CONTENT)
      return undefined
    }

    const timers = [
      scheduleStageUpdate(REVEAL_STAGE.TITLE, 140, setStage),
      scheduleStageUpdate(REVEAL_STAGE.DESCRIPTION, 280, setStage),
      scheduleStageUpdate(REVEAL_STAGE.CONTENT, 440, setStage),
    ]

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  return stage
}
