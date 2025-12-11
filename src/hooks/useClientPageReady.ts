"use client"

import { useEffect, useState } from 'react'

export function useClientPageReady() {
  const [heroReady, setHeroReady] = useState(false)

  useEffect(() => {
    setHeroReady(true)
  }, [])

  return heroReady
}
