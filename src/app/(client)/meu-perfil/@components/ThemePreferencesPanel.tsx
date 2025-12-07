import { type ChangeEvent, type RefObject } from 'react'

import { REVEAL_STAGE } from '@/lib/useLavaRevealStage'

import styles from '../meu-perfil.module.css'
import { type ThemeState } from '../types'

type ThemePreferencesPanelProps = {
  theme: ThemeState
  isPaletteOpen: boolean
  revealStage: number
  canEditAppearance: boolean
  onToggle: () => void
  onClose: () => void
  onPaletteSwatch: (css: string) => void
  handleCardTopColor: (event: ChangeEvent<HTMLInputElement>) => void
  handleCardBottomColor: (event: ChangeEvent<HTMLInputElement>) => void
  handleCardBorderColor: (event: ChangeEvent<HTMLInputElement>) => void
  handleCardBorderAlpha: (event: ChangeEvent<HTMLInputElement>) => void
  handleBackgroundTopColor: (event: ChangeEvent<HTMLInputElement>) => void
  handleBackgroundBottomColor: (event: ChangeEvent<HTMLInputElement>) => void
  handleGlassBorderColor: (event: ChangeEvent<HTMLInputElement>) => void
  handleGlassBorderAlpha: (event: ChangeEvent<HTMLInputElement>) => void
  handleGlassColor: (event: ChangeEvent<HTMLInputElement>) => void
  handleGlassAlpha: (event: ChangeEvent<HTMLInputElement>) => void
  handleBubbleDarkColor: (event: ChangeEvent<HTMLInputElement>) => void
  handleBubbleLightColor: (event: ChangeEvent<HTMLInputElement>) => void
  handleBubbleAlphaMin: (event: ChangeEvent<HTMLInputElement>) => void
  handleBubbleAlphaMax: (event: ChangeEvent<HTMLInputElement>) => void
  applyHexFromRef: (ref: RefObject<HTMLInputElement | null>, apply: (value: string) => void) => void
  applyCardTop: (value: string) => void
  applyCardBottom: (value: string) => void
  applyCardBorder: (hex: string, alpha: number) => void
  applyBackgroundTop: (value: string) => void
  applyBackgroundBottom: (value: string) => void
  applyGlassBorder: (hex: string, alpha: number) => void
  applyGlass: (hex: string, alpha: number) => void
  applyBubbleDark: (value: string) => void
  applyBubbleLight: (value: string) => void
  cardTopHexRef: RefObject<HTMLInputElement | null>
  cardBottomHexRef: RefObject<HTMLInputElement | null>
  cardBorderHexRef: RefObject<HTMLInputElement | null>
  bgTopHexRef: RefObject<HTMLInputElement | null>
  bgBottomHexRef: RefObject<HTMLInputElement | null>
  glassBorderHexRef: RefObject<HTMLInputElement | null>
  glassHexRef: RefObject<HTMLInputElement | null>
  bubbleDarkHexRef: RefObject<HTMLInputElement | null>
  bubbleLightHexRef: RefObject<HTMLInputElement | null>
}

export function ThemePreferencesPanel({
  theme,
  isPaletteOpen,
  revealStage,
  canEditAppearance,
  onToggle,
  onClose,
  onPaletteSwatch,
  handleCardTopColor,
  handleCardBottomColor,
  handleCardBorderColor,
  handleCardBorderAlpha,
  handleBackgroundTopColor,
  handleBackgroundBottomColor,
  handleGlassBorderColor,
  handleGlassBorderAlpha,
  handleGlassColor,
  handleGlassAlpha,
  handleBubbleDarkColor,
  handleBubbleLightColor,
  handleBubbleAlphaMin,
  handleBubbleAlphaMax,
  applyHexFromRef,
  applyCardTop,
  applyCardBottom,
  applyCardBorder,
  applyBackgroundTop,
  applyBackgroundBottom,
  applyGlassBorder,
  applyGlass,
  applyBubbleDark,
  applyBubbleLight,
  cardTopHexRef,
  cardBottomHexRef,
  cardBorderHexRef,
  bgTopHexRef,
  bgBottomHexRef,
  glassBorderHexRef,
  glassHexRef,
  bubbleDarkHexRef,
  bubbleLightHexRef,
}: ThemePreferencesPanelProps) {
  if (!canEditAppearance) return null

  return (
    <>
      <button
        id="paletteBtn"
        type="button"
        title="Personalizar"
        onClick={onToggle}
        className={`${styles.revealSeq} ${styles.revealContent}`}
        data-visible={revealStage >= REVEAL_STAGE.CONTENT}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="9" />
          <path d="M14.8 14.8a3 3 0 1 1-4.6-3.6" />
          <path d="M7.2 7.2l1.8 1.8" />
          <path d="M16.8 7.2l-1.8 1.8" />
        </svg>
      </button>

      <div
        id="palettePanel"
        className={`${isPaletteOpen ? 'open' : ''} ${styles.revealSeq} ${styles.revealContent}`}
        data-visible={revealStage >= REVEAL_STAGE.CONTENT}
      >
        <div id="panelScroll">
          <div className="pal-section">
            <h3>Cards (livre)</h3>
            <div className="row">
              <span className="small">Superior</span>
              <input
                type="color"
                className="colorpicker"
                id="cardTop"
                value={theme.innerTop}
                onChange={handleCardTopColor}
              />
            </div>
            <div className="row">
              <span className="small">Inferior</span>
              <input
                type="color"
                className="colorpicker"
                id="cardBottom"
                value={theme.innerBottom}
                onChange={handleCardBottomColor}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="cardTopHex"
                placeholder="#RRGGBB"
                ref={cardTopHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="addCardTop"
                onClick={() => applyHexFromRef(cardTopHexRef, applyCardTop)}
              >
                Aplicar sup.
              </button>
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="cardBottomHex"
                placeholder="#RRGGBB"
                ref={cardBottomHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="addCardBottom"
                onClick={() => applyHexFromRef(cardBottomHexRef, applyCardBottom)}
              >
                Aplicar inf.
              </button>
            </div>
            <div className="row">
              <span className="small">Borda card</span>
              <input
                type="color"
                className="colorpicker"
                id="cardBorderColor"
                value={theme.cardBorderHex}
                onChange={handleCardBorderColor}
              />
            </div>
            <div className="row">
              <span className="small">Opacidade borda</span>
              <input
                type="range"
                className="range"
                id="cardBorderAlpha"
                min="0"
                max="1"
                step="0.01"
                value={theme.cardBorderAlpha}
                onChange={handleCardBorderAlpha}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="cardBorderHex"
                placeholder="#RRGGBB"
                ref={cardBorderHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="applyCardBorderHex"
                onClick={() =>
                  applyHexFromRef(cardBorderHexRef, (value) =>
                    applyCardBorder(value, theme.cardBorderAlpha),
                  )
                }
              >
                Aplicar borda
              </button>
            </div>
            <div className="hr" />
          </div>
          <div className="pal-section">
            <h3>Background</h3>
            <div className="pal-options">
              <div
                className="swatch"
                style={{ background: '#cfe6d5' }}
                onClick={() => onPaletteSwatch('--bg-top:#cfe6d5;--bg-bottom:#eef3e6')}
              />
              <div
                className="swatch"
                style={{ background: '#e3e8df' }}
                onClick={() => onPaletteSwatch('--bg-top:#e3e8df;--bg-bottom:#f2f3ef')}
              />
              <div
                className="swatch"
                style={{ background: '#dbece3' }}
                onClick={() => onPaletteSwatch('--bg-top:#dbece3;--bg-bottom:#eef4ec')}
              />
            </div>
            <div className="row">
              <span className="small">Topo</span>
              <input
                type="color"
                className="colorpicker"
                id="bgTop"
                value={theme.bgTop}
                onChange={handleBackgroundTopColor}
              />
            </div>
            <div className="row">
              <span className="small">Base</span>
              <input
                type="color"
                className="colorpicker"
                id="bgBottom"
                value={theme.bgBottom}
                onChange={handleBackgroundBottomColor}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="bgTopHex"
                placeholder="#RRGGBB"
                ref={bgTopHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="addBgTop"
                onClick={() => applyHexFromRef(bgTopHexRef, applyBackgroundTop)}
              >
                Aplicar topo
              </button>
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="bgBottomHex"
                placeholder="#RRGGBB"
                ref={bgBottomHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="addBgBottom"
                onClick={() => applyHexFromRef(bgBottomHexRef, applyBackgroundBottom)}
              >
                Aplicar base
              </button>
            </div>
            <div className="hr" />
          </div>
          <div className="pal-section">
            <h3>Overlay (vidro)</h3>
            <div className="pal-options">
              <div
                className="swatch"
                style={{ background: 'rgba(236,250,241,.34)' }}
                onClick={() => onPaletteSwatch('--glass:rgba(236,250,241,.34)')}
              />
              <div
                className="swatch"
                style={{ background: 'rgba(240,245,240,.42)' }}
                onClick={() => onPaletteSwatch('--glass:rgba(240,245,240,.42)')}
              />
              <div
                className="swatch"
                style={{ background: 'rgba(230,240,235,.50)' }}
                onClick={() => onPaletteSwatch('--glass:rgba(230,240,235,.50)')}
              />
            </div>
            <div className="row">
              <span className="small">Cor</span>
              <input
                type="color"
                className="colorpicker"
                id="glassColor"
                value={theme.glassColor}
                onChange={handleGlassColor}
              />
            </div>
            <div className="row">
              <span className="small">Opacidade</span>
              <input
                type="range"
                className="range"
                id="glassAlpha"
                min="0"
                max="1"
                step="0.01"
                value={theme.glassAlpha}
                onChange={handleGlassAlpha}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="glassHex"
                placeholder="#RRGGBB"
                ref={glassHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="applyGlassHex"
                onClick={() => applyHexFromRef(glassHexRef, (value) => applyGlass(value, theme.glassAlpha))}
              >
                Aplicar cor
              </button>
            </div>
            <div className="row">
              <span className="small">Borda vidro</span>
              <input
                type="color"
                className="colorpicker"
                id="glassBorderColor"
                value={theme.glassBorderHex}
                onChange={handleGlassBorderColor}
              />
            </div>
            <div className="row">
              <span className="small">Opacidade borda</span>
              <input
                type="range"
                className="range"
                id="glassBorderAlpha"
                min="0"
                max="1"
                step="0.01"
                value={theme.glassBorderAlpha}
                onChange={handleGlassBorderAlpha}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="glassBorderHex"
                placeholder="#RRGGBB"
                ref={glassBorderHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="applyGlassBorderHex"
                onClick={() =>
                  applyHexFromRef(glassBorderHexRef, (value) =>
                    applyGlassBorder(value, theme.glassBorderAlpha),
                  )
                }
              >
                Aplicar borda
              </button>
            </div>
            <div className="hr" />
          </div>
          <div className="pal-section">
            <h3>Bolhas</h3>
            <div className="pal-options">
              <div
                className="swatch"
                style={{ background: '#7aa98a' }}
                onClick={() => onPaletteSwatch('--dark:#7aa98a;--light:#bcd6c3')}
              />
              <div
                className="swatch"
                style={{ background: '#86b79c' }}
                onClick={() => onPaletteSwatch('--dark:#86b79c;--light:#cae0cf')}
              />
              <div
                className="swatch"
                style={{ background: '#9ccbb1' }}
                onClick={() => onPaletteSwatch('--dark:#9ccbb1;--light:#d7ede1')}
              />
            </div>
            <div className="row">
              <span className="small">Escura</span>
              <input
                type="color"
                className="colorpicker"
                id="bubbleDark"
                value={theme.bubbleDark}
                onChange={handleBubbleDarkColor}
              />
            </div>
            <div className="row">
              <span className="small">Clara</span>
              <input
                type="color"
                className="colorpicker"
                id="bubbleLight"
                value={theme.bubbleLight}
                onChange={handleBubbleLightColor}
              />
            </div>
            <div className="row">
              <span className="small">Opac. mín</span>
              <input
                type="range"
                className="range"
                id="bubbleAlphaMin"
                min="0"
                max="1"
                step="0.01"
                value={theme.bubbleAlphaMin}
                onChange={handleBubbleAlphaMin}
              />
            </div>
            <div className="row">
              <span className="small">Opac. máx</span>
              <input
                type="range"
                className="range"
                id="bubbleAlphaMax"
                min="0"
                max="1"
                step="0.01"
                value={theme.bubbleAlphaMax}
                onChange={handleBubbleAlphaMax}
              />
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="bubbleDarkHex"
                placeholder="#RRGGBB"
                ref={bubbleDarkHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="applyBubbleDark"
                onClick={() => applyHexFromRef(bubbleDarkHexRef, applyBubbleDark)}
              >
                Aplicar escura
              </button>
            </div>
            <div className="row">
              <input
                type="text"
                className="input-hex"
                id="bubbleLightHex"
                placeholder="#RRGGBB"
                ref={bubbleLightHexRef}
              />
              <button
                className="btn-mini"
                type="button"
                id="applyBubbleLight"
                onClick={() => applyHexFromRef(bubbleLightHexRef, applyBubbleLight)}
              >
                Aplicar clara
              </button>
            </div>
          </div>
        </div>
        <button id="saveBtn" type="button" onClick={onClose}>
          Fechar painel
        </button>
      </div>
    </>
  )
}
