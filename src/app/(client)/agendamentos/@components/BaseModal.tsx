import type { ReactNode } from 'react'

import styles from '../agendamentos.module.css'

type BaseModalProps = {
  isOpen: boolean
  onClose?: () => void
  children: ReactNode
  contentClassName?: string
  disableBackdropClose?: boolean
}

export function BaseModal({
  isOpen,
  onClose,
  children,
  contentClassName,
  disableBackdropClose,
}: BaseModalProps) {
  if (!isOpen) return null

  const handleBackdrop = disableBackdropClose ? undefined : onClose
  const contentClass = contentClassName ? `${styles.modalContent} ${contentClassName}` : styles.modalContent

  return (
    <div className={styles.modal} aria-hidden="false">
      <div className={styles.modalBackdrop} onClick={handleBackdrop} />
      <div className={contentClass} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  )
}
