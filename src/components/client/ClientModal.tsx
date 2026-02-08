import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { ClientBaseModal } from './ClientBaseModal'
import styles from './client-modal.module.css'

type Tone = 'neutral' | 'warning' | 'success' | 'info'
type Size = 'md' | 'lg'

type ClientModalProps = {
  isOpen: boolean
  onClose?: () => void
  title: string
  children: ReactNode
  tone?: Tone
  size?: Size
  icon?: ReactNode
  actions?: ReactNode
  bodyClassName?: string
  actionsClassName?: string
  titleClassName?: string
  contentClassName?: string
  disableBackdropClose?: boolean
  wrapBody?: boolean
  contentProps?: ComponentPropsWithoutRef<'div'>
}

const toneClassName: Record<Tone, string> = {
  neutral: '',
  warning: styles.toneWarning,
  success: styles.toneSuccess,
  info: styles.toneInfo,
}

const sizeClassName: Record<Size, string> = {
  md: styles.modalContent,
  lg: `${styles.modalContent} ${styles.modalContentLarge}`,
}

export function ClientModal({
  isOpen,
  onClose,
  title,
  children,
  tone = 'neutral',
  size = 'md',
  icon,
  actions,
  bodyClassName,
  actionsClassName,
  titleClassName,
  contentClassName,
  disableBackdropClose,
  wrapBody = true,
  contentProps: contentPropsOverride,
}: ClientModalProps) {
  const toneClass = toneClassName[tone]
  const sizeClass = sizeClassName[size]
  const headingId = typeof contentPropsOverride?.['aria-labelledby'] === 'string'
    ? contentPropsOverride['aria-labelledby']
    : undefined

  const mergedContentClass = [sizeClass, toneClass, contentClassName].filter(Boolean).join(' ')
  const mergedBodyClass = [styles.modalBody, bodyClassName].filter(Boolean).join(' ')
  const mergedActionsClass = [styles.modalActions, actionsClassName].filter(Boolean).join(' ')
  const mergedTitleClass = [styles.modalTitle, titleClassName].filter(Boolean).join(' ')

  const body = wrapBody ? (
    <div className={mergedBodyClass}>
      {children}
    </div>
  ) : (
    children
  )

  return (
    <ClientBaseModal
      isOpen={isOpen}
      onClose={onClose}
      className={styles.modal}
      backdropClassName={styles.modalBackdrop}
      contentClassName={mergedContentClass}
      disableBackdropClose={disableBackdropClose}
      contentProps={{
        role: 'dialog',
        'aria-modal': 'true',
        ...contentPropsOverride,
      }}
    >
      {icon ? <div className={styles.modalIcon}>{icon}</div> : null}
      <h2 id={headingId} className={mergedTitleClass}>{title}</h2>
      {body}
      {actions ? <div className={mergedActionsClass}>{actions}</div> : null}
    </ClientBaseModal>
  )
}
