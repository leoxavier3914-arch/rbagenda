'use client'

import Link from 'next/link'

import {
  ClientPageHeader,
  ClientPageShell,
  ClientSection,
} from '@/components/client/ClientPageLayout'
import { useClientPageReady } from '@/hooks/useClientPageReady'
import { useClientSessionGuard } from '@/hooks/useClientSessionGuard'

import styles from './indice.module.css'

const quickLinks = [
  {
    href: '/catalogo',
    title: 'Catálogo',
    description: 'Explore opções, fotos e valores antes de escolher seu procedimento.',
  },
  {
    href: '/procedimento',
    title: 'Agendar um atendimento',
    description: 'Escolha o melhor horário e confirme a reserva em poucos passos.',
  },
  {
    href: '/agendamentos',
    title: 'Ver meus agendamentos',
    description: 'Acompanhe todos os compromissos, status e detalhes importantes.',
  },
  {
    href: '/meu-perfil',
    title: 'Atualizar meus dados',
    description: 'Mantenha seu perfil, contatos e preferências sempre atualizados.',
  },
]

export default function DashboardIndexPage() {
  const heroReady = useClientPageReady()
  useClientSessionGuard()

  return (
    <ClientPageShell heroReady={heroReady} forceMotion>
      <ClientSection className={styles.section}>
        <div className={styles.panel}>
          <div className={styles.headerArea}>
            <span className="badge">Central rápida</span>
            <ClientPageHeader
              title="Índice do estúdio"
              subtitle="Acesse rapidamente as áreas principais do aplicativo. Tudo organizado para facilitar o seu dia a dia."
              hideDiamond
              className={styles.header}
              subtitleClassName={styles.subtitle}
            />
          </div>

          <ul className={styles.quickLinks}>
            {quickLinks.map((link) => (
              <li key={link.href} className={styles.quickLink}>
                <div className={styles.quickLinkContent}>
                  <h2 className={styles.quickLinkTitle}>{link.title}</h2>
                  <p className={styles.quickLinkDescription}>{link.description}</p>
                </div>

                <Link className={styles.quickLinkAction} href={link.href}>
                  Acessar
                  <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </ClientSection>
    </ClientPageShell>
  )
}
