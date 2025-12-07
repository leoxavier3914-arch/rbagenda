export type Profile = {
  full_name: string | null
  whatsapp: string | null
  email: string | null
  birth_date: string | null
  role?: 'admin' | 'adminsuper' | 'adminmaster' | 'client'
}

export type ThemeState = {
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

export const defaultTheme: ThemeState = {
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
