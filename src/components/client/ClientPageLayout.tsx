import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  forwardRef,
  useEffect,
} from 'react'

function joinClasses(...values: Array<string | undefined | null | false>) {
  return values.filter(Boolean).join(' ')
}

type ClientPageShellProps = ComponentPropsWithoutRef<'main'> & {
  heroReady?: boolean
  forceMotion?: boolean
  respectNoMotionHash?: boolean
  viewport?: 'default' | 'app'
  children: ReactNode
}

export function ClientPageShell({
  heroReady,
  className,
  forceMotion = false,
  respectNoMotionHash = false,
  viewport = 'default',
  children,
  ...rest
}: ClientPageShellProps) {
  const wrapperClassName = joinClasses(
    'client-hero-wrapper',
    viewport === 'app' ? 'client-app-shell' : undefined,
    heroReady ? 'client-hero-ready' : undefined,
    className,
  )

  useEffect(() => {
    if (!forceMotion) return

    const root = document.documentElement
    root.classList.add('force-motion')

    if (respectNoMotionHash && window.location.hash.includes('nomotion')) {
      root.classList.remove('force-motion')
    }

    return () => {
      root.classList.remove('force-motion')
    }
  }, [forceMotion, respectNoMotionHash])

  return (
    <main className={wrapperClassName} {...rest}>
      <div className="page">{children}</div>
    </main>
  )
}

type ClientSectionProps = ComponentPropsWithoutRef<'section'> & {
  children: ReactNode
}

export function ClientSection({ className, children, ...rest }: ClientSectionProps) {
  return (
    <section className={joinClasses('center', className)} {...rest}>
      <div className="stack">{children}</div>
    </section>
  )
}

type ClientPageHeaderProps = Omit<ComponentPropsWithoutRef<'header'>, 'title'> & {
  title: ReactNode
  subtitle?: ReactNode
  subtitleClassName?: string
  subtitleProps?: ComponentPropsWithoutRef<'p'>
  hideDiamond?: boolean
  htmlTitle?: string
}

export function ClientPageHeader({
  title,
  subtitle,
  subtitleClassName,
  subtitleProps,
  hideDiamond,
  className,
  htmlTitle,
  ...rest
}: ClientPageHeaderProps) {
  const subtitleClass = joinClasses(subtitleClassName, subtitleProps?.className)

  return (
    <header className={className} title={htmlTitle} {...rest}>
      {hideDiamond ? null : (
        <svg
          aria-hidden="true"
          className="diamond"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M12 3l4 4-4 4-4-4 4-4Z" />
          <path d="M12 13l4 4-4 4-4-4 4-4Z" />
        </svg>
      )}
      <h1>{title}</h1>
      {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
    </header>
  )
}

type ClientGlassPanelLabelProps = ComponentPropsWithoutRef<'div'> &
  Record<`data-${string}` | string, string | number | boolean | undefined>

type ClientGlassPanelProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode
  label?: ReactNode
  labelClassName?: string
  labelProps?: ClientGlassPanelLabelProps
}

export const ClientGlassPanel = forwardRef<HTMLDivElement, ClientGlassPanelProps>(
  function ClientGlassPanel({ label, labelClassName, labelProps, className, children, ...rest }, ref) {
    const panelClassName = joinClasses('glass', className)
    const mergedLabelClass = joinClasses('label', labelClassName, labelProps?.className)
    const mergedLabelProps = label
      ? { ...labelProps, className: mergedLabelClass }
      : undefined

    return (
      <div ref={ref} className={panelClassName} {...rest}>
        {label ? <div {...mergedLabelProps}>{label}</div> : null}
        {children}
      </div>
    )
  },
)
