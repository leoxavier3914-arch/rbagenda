import type { PropsWithChildren } from 'react'

import styles from './FlowShell.module.css'

type FlowShellProps = PropsWithChildren<{ className?: string }>

export function FlowShell({ children, className }: FlowShellProps) {
  const classes = [styles.shell, className].filter(Boolean).join(' ')
  return <div className={classes}>{children}</div>
}

export default FlowShell
