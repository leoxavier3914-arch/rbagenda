import { ClientPageHeader } from '@/components/client/ClientPageLayout'

import styles from '../agendamentos.module.css'

type AppointmentsHeaderProps = {
  subtitleClassName?: string
}

export function AppointmentsHeader({ subtitleClassName = styles.subtitle }: AppointmentsHeaderProps) {
  return (
    <ClientPageHeader
      title="Meus agendamentos"
      subtitle="Veja seus horários ativos e históricos"
      subtitleClassName={subtitleClassName}
    />
  )
}
