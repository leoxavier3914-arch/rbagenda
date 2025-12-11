import { type ReactNode } from 'react'

import { ClientPageHeader } from '@/components/client/ClientPageLayout'

type ProcedimentoHeaderProps = {
  children: ReactNode
  className?: string
}

export function ProcedimentoHeader({ children, className }: ProcedimentoHeaderProps) {
  return <ClientPageHeader title={children} className={className} />
}
