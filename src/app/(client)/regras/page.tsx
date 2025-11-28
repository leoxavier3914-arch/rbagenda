import styles from "./rules.module.css";

const ruleSections = [
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
];

export default function DashboardRulesPage() {
  return (
    <main className={styles.page}>
      <div className={styles.backdrop}>
        <div className={styles.backdropLayer} />
        <div className={`${styles.blurBubble} ${styles.blurBubblePrimary}`} />
        <div className={`${styles.blurBubble} ${styles.blurBubbleSecondary}`} />
      </div>

      <div className={styles.content}>
        <header className={styles.heading}>
          <span className={styles.mark}>◆</span>
          <div className="space-y-2">
            <h1 className={styles.title}>
              Antes de confirmar, <span>leia com atenção:</span>
            </h1>
            <p className={styles.subtitle}>
              Cada regra fica em um card único, alinhado em coluna, no mesmo acabamento do procedimento.
            </p>
          </div>
        </header>

        <div className={styles.glass}>
          {ruleSections.map((section) => (
            <div key={section.label} className={styles.card}>
              <div className={styles.cardInner}>
                <p className={styles.eyebrow}>{section.eyebrow}</p>
                <h2 className={styles.cardTitle}>{section.label}</h2>
                <div className={styles.inlineList}>
                  {section.items.map((item, index) => (
                    <span key={item} className={styles.inlineItem}>
                      {index === 0 ? (
                        <span className={styles.inlineItemMarker} />
                      ) : (
                        <span aria-hidden className={styles.inlineItemDivider}>
                          •
                        </span>
                      )}
                      <span>{item}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className={styles.footerMark}>ROMEIKE BEAUTY</p>
      </div>
    </main>
  );
}
