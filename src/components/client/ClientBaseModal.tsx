import type { ComponentPropsWithoutRef, ReactNode } from 'react'

type ClientBaseModalProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  isOpen: boolean
  onClose?: () => void
  children: ReactNode
  contentClassName?: string
  contentProps?: ComponentPropsWithoutRef<'div'>
  backdropClassName?: string
  disableBackdropClose?: boolean
}

export function ClientBaseModal({
  isOpen,
  onClose,
  children,
  className,
  contentClassName,
  contentProps,
  backdropClassName,
  disableBackdropClose,
  ...rest
}: ClientBaseModalProps) {
  if (!isOpen) return null

  const handleBackdrop = disableBackdropClose ? undefined : onClose
  const mergedContentClass = [contentClassName, contentProps?.className].filter(Boolean).join(' ')
  const mergedContentProps: ComponentPropsWithoutRef<'div'> = {
    role: contentProps?.role ?? 'dialog',
    'aria-modal': contentProps?.['aria-modal'] ?? 'true',
    ...contentProps,
    className: mergedContentClass,
  }

  return (
    <div className={className} aria-hidden="false" {...rest}>
      <div className={backdropClassName} onClick={handleBackdrop} />
      <div {...mergedContentProps}>
        {children}
      </div>
    </div>
  )
}
