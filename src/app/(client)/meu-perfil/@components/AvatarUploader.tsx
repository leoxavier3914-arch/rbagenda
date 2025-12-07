/* eslint-disable @next/next/no-img-element */
import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react'

import styles from '../meu-perfil.module.css'

type AvatarUploaderProps = {
  avatarDataUrl: string
  resolvedName: string
  isAvatarMenuOpen: boolean
  avatarBoxRef: RefObject<HTMLDivElement | null>
  avatarActionsRef: RefObject<HTMLDivElement | null>
  avatarInputRef: RefObject<HTMLInputElement | null>
  onToggle: () => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
}

export function AvatarUploader({
  avatarDataUrl,
  resolvedName,
  isAvatarMenuOpen,
  avatarBoxRef,
  avatarActionsRef,
  avatarInputRef,
  onToggle,
  onKeyDown,
  onChange,
  onRemove,
}: AvatarUploaderProps) {
  return (
    <div className={styles.avatarWrap}>
      <div
        className={styles.avatar}
        id="avatarBox"
        ref={avatarBoxRef}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="button"
        aria-label="Abrir ações do avatar"
        aria-expanded={isAvatarMenuOpen}
        aria-controls="avatarActions"
      >
        {avatarDataUrl ? (
          <img src={avatarDataUrl} alt="" title="" />
        ) : (
          <div className={styles.avatarPlaceholder} aria-hidden="true">
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c2-3 5-5 8-5s6 2 8 5" />
            </svg>
          </div>
        )}
        <div className={styles.avatarActionsOverlay} data-open={isAvatarMenuOpen}>
          <div className={styles.avatarActions} id="avatarActions" ref={avatarActionsRef}>
            <label className={styles.btn}>
              <input
                id="avatarInput"
                type="file"
                accept="image/*"
                hidden
                ref={avatarInputRef}
                onChange={onChange}
              />
              Enviar foto
            </label>
            <button type="button" className={styles.btn} onClick={onRemove}>
              Remover foto
            </button>
          </div>
        </div>
      </div>
      {resolvedName ? <p className={styles.profileName}>{resolvedName}</p> : null}
    </div>
  )
}
