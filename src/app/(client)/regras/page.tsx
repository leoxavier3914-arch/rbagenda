"use client"

import { ClientPageShell, ClientSection } from "@/components/client/ClientPageLayout"
import { useClientSessionGuard } from "@/hooks/useClientSessionGuard"
import { useClientPageReady } from "@/hooks/useClientPageReady"

import { RulesHeader, RulesSectionList } from "./@components"
import type { RuleSection } from "./types"
import styles from "./regras.module.css"

const ruleSections: RuleSection[] = [
  {
    label: "Antes de agendar",
    eyebrow: "ANTES DE AGENDAR",
    items: [
      "Veja o tipo de procedimento e profissional antes de confirmar.",
      "Escolha datas com antecedência e deixe contatos atualizados para os lembretes.",
      "Chegue com a pele limpa e sem maquiagem para agilizar o atendimento.",
    ],
  },
  {
    label: "Atrasos & cancelamentos",
    eyebrow: "ATRASOS & CANCELAMENTOS",
    items: [
      "Tolerância de 10 minutos; atrasos maiores podem ser reagendados.",
      "Cancele ou remarque com 24h de antecedência para liberar o horário.",
      "No-show ou cancelamentos em cima da hora podem reter o sinal.",
    ],
  },
  {
    label: "Durante o atendimento",
    eyebrow: "DURANTE O ATENDIMENTO",
    items: [
      "Evite acompanhantes e chegue alguns minutos antes para o check-in.",
      "Informe alergias, medicações ou sensibilidades para adequar o protocolo.",
      "Siga as orientações pós-procedimento enviadas no app para melhores resultados.",
    ],
  },
]

export default function DashboardRulesPage() {
  useClientSessionGuard()
  const heroReady = useClientPageReady()

  return (
    <ClientPageShell heroReady={heroReady} forceMotion>
      <ClientSection>
        <div className={styles.page}>
          <div className={`${styles.content} ${styles.textReset}`}>
            <RulesHeader />
            <RulesSectionList sections={ruleSections} />
            <p className={styles.footerMark}>ROMEIKE BEAUTY</p>
          </div>
        </div>
      </ClientSection>
    </ClientPageShell>
  )
}
