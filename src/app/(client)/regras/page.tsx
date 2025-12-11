"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { ClientPageShell, ClientSection } from "@/components/client/ClientPageLayout"
import { supabase } from "@/lib/db"

import { RulesHeader } from "./@components/RulesHeader"
import { RulesSectionList } from "./@components/RulesSectionList"
import type { RuleSection } from "./types"
import styles from "./rules.module.css"

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
  const [heroReady, setHeroReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setHeroReady(true)
  }, [])

  useEffect(() => {
    let active = true

    const verifySession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return

      if (error) {
        console.error("Erro ao obter sessão", error)
        router.replace("/login")
        return
      }

      if (!data.session) {
        router.replace("/login")
      }
    }

    void verifySession()

    return () => {
      active = false
    }
  }, [router])

  return (
    <ClientPageShell heroReady={heroReady}>
      <ClientSection>
        <div className={styles.page}>
          <div className={styles.content}>
            <RulesHeader />
            <RulesSectionList sections={ruleSections} />
            <p className={styles.footerMark}>ROMEIKE BEAUTY</p>
          </div>
        </div>
      </ClientSection>
    </ClientPageShell>
  )
}
