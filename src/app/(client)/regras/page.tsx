const ruleSections = [
  {
    title: 'Antes de agendar',
    items: [
      'Veja o tipo de procedimento e profissional antes de confirmar.',
      'Escolha datas com antecedência e deixe contatos atualizados para os lembretes.',
      'Chegue com a pele limpa e sem maquiagem para agilizar o atendimento.',
    ],
  },
  {
    title: 'Atrasos & cancelamentos',
    items: [
      'Tolerância de 10 minutos; atrasos maiores podem ser reagendados.',
      'Cancele ou remarque com 24h de antecedência para liberar o horário.',
      'No-show ou cancelamentos em cima da hora podem reter o sinal.',
    ],
  },
  {
    title: 'Durante o atendimento',
    items: [
      'Evite acompanhantes e chegue alguns minutos antes para o check-in.',
      'Informe alergias, medicações ou sensibilidades para adequar o protocolo.',
      'Siga as orientações pós-procedimento enviadas no app para melhores resultados.',
    ],
  },
]

export default function DashboardRulesPage() {
  return (
    <div className="relative min-h-[80vh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-emerald-50/50 to-white/70 mix-blend-screen" />
        <div className="absolute left-4 top-10 h-64 w-64 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute bottom-6 right-4 h-56 w-56 rounded-full bg-emerald-100/35 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-emerald-700 shadow-lg ring-1 ring-emerald-900/10">
            <span className="text-xl font-semibold">✦</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Regras da casa</p>
          <h1 className="text-3xl font-semibold text-[#10211a] sm:text-4xl">Antes de confirmar, leia com atenção:</h1>
          <p className="text-sm text-[color:rgba(16,33,26,0.75)]">
            Mantivemos o fundo lavalamp e reunimos os principais combinados em um cartão único,
            seguindo o visual suave das outras páginas do app.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-[32px] border border-white/60 bg-gradient-to-b from-emerald-800/90 via-emerald-700/90 to-emerald-600/85 text-emerald-50 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-6 py-4 text-white/80 sm:px-8">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">Guia rápido</span>
            <span className="text-xs sm:text-sm">Políticas para agendar com tranquilidade</span>
          </div>

          <div className="space-y-4 bg-white/5 px-6 py-6 sm:px-8 sm:py-8">
            {ruleSections.map((section) => (
              <div
                key={section.title}
                className="rounded-2xl bg-white/92 p-5 text-[#10211a] shadow-lg ring-1 ring-emerald-100/70 backdrop-blur"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Orientações</p>
                <h2 className="text-xl font-semibold text-[#0f1f18]">{section.title}</h2>
                <ul className="mt-3 space-y-2 text-sm text-[color:rgba(16,33,26,0.82)]">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-1 inline-flex h-2.5 w-2.5 flex-none items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-[0_0_0_6px_rgba(16,185,129,0.08)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
