const ruleSections = [
  {
    label: "Antes de agendar",
    eyebrow: "ANTES DE AGENDAR",
    items: [
      "Veja o tipo de procedimento e profissional antes de confirmar.",
      "Escolha datas com antecedência e deixe contatos atualizados para os lembretes.",
      "Chegue com a pele limpa e sem maquiagem para agilizar o atendimento.",
    ],
    cardTone: "from-white/70 via-white/80 to-white/70",
  },
  {
    label: "Atrasos & cancelamentos",
    eyebrow: "ATRASOS & CANCELAMENTOS",
    items: [
      "Tolerância de 10 minutos; atrasos maiores podem ser reagendados.",
      "Cancele ou remarque com 24h de antecedência para liberar o horário.",
      "No-show ou cancelamentos em cima da hora podem reter o sinal.",
    ],
    cardTone: "from-white/60 via-white/70 to-white/60",
  },
  {
    label: "Durante o atendimento",
    eyebrow: "DURANTE O ATENDIMENTO",
    items: [
      "Evite acompanhantes e chegue alguns minutos antes para o check-in.",
      "Informe alergias, medicações ou sensibilidades para adequar o protocolo.",
      "Siga as orientações pós-procedimento enviadas no app para melhores resultados.",
    ],
    cardTone: "from-white/50 via-white/60 to-white/50",
  },
];

export default function DashboardRulesPage() {
  return (
    <main className="relative min-h-[85vh] w-full overflow-hidden px-4 py-12 sm:px-6 sm:py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-emerald-50/20 to-white/30" />
        <div className="absolute left-6 top-10 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute bottom-10 right-6 h-72 w-72 rounded-full bg-emerald-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 rounded-[36px] border border-white/40 bg-white/35 p-6 shadow-[0_32px_80px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:p-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-[18px] tracking-[0.3em] text-emerald-900/60">◆</span>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold leading-tight text-emerald-950 sm:text-4xl">
              Antes de confirmar, <span className="font-normal">leia com atenção:</span>
            </h1>
            <p className="text-sm text-emerald-950/80 sm:text-base">
              Cada combinado fica em seu próprio card, no mesmo estilo moderno das outras páginas e preservando o fundo lavalamp.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {ruleSections.map((section) => (
            <div
              key={section.label}
              className="group relative rounded-[28px] border border-white/65 bg-gradient-to-br shadow-[0_18px_40px_rgba(0,0,0,0.08)] backdrop-blur"
            >
              <div
                className={`pointer-events-none absolute inset-[1px] rounded-[26px] bg-gradient-to-br ${section.cardTone}`}
              />
              <div className="relative flex h-full flex-col gap-4 px-5 py-6">
                <p className="text-[11px] tracking-[0.22em] text-emerald-900/65">{section.eyebrow}</p>
                <h2 className="text-xl font-semibold text-emerald-950">{section.label}</h2>
                <ul className="space-y-3 text-[14px] leading-relaxed text-emerald-950/90">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-[6px] w-[6px] rounded-full bg-emerald-700/80 transition-all group-hover:shadow-[0_0_0_6px_rgba(16,185,129,0.14)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-[11px] tracking-[0.3em] text-emerald-900/60">ROMEIKE BEAUTY</p>
      </div>
    </main>
  );
}
