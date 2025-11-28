const heroHighlights = [
  {
    label: 'Cancelamento',
    value: '12h de antecedência',
    detail: 'Sem taxas extras dentro do prazo.',
  },
  {
    label: 'Pontualidade',
    value: '+10 min de tolerância',
    detail: 'Atrasos maiores podem ser reagendados.',
  },
  {
    label: 'Sinal',
    value: 'Abatido no dia',
    detail: 'Valor de reserva descontado do atendimento.',
  },
]

const policyBlocks = [
  {
    title: 'Agendamentos e remarcações',
    description:
      'Planeje com antecedência para garantir horários com sua profissional favorita e facilitar ajustes quando necessário.',
    items: [
      'Use o app para escolher data, profissional e serviço em poucos cliques.',
      'Reagende com, no mínimo, 24h de antecedência para manter o fluxo das agendas.',
      'Mudanças frequentes podem limitar novas remarcações em períodos de pico.',
    ],
  },
  {
    title: 'Cancelamentos responsáveis',
    description:
      'A agenda funciona como uma fila justa para todas. Comunique imprevistos o quanto antes para reabrirmos o horário.',
    items: [
      'Cancelamentos até 12h antes: sem cobrança adicional.',
      'Após o prazo, o sinal pode ser retido para cobrir custos operacionais.',
      'Ausências sem aviso podem gerar bloqueio temporário de novas reservas.',
    ],
  },
  {
    title: 'No dia do atendimento',
    description:
      'Chegue com alguns minutos de antecedência para confirmar dados, preferências e iniciar no horário combinado.',
    items: [
      'Antecipe-se 10 minutos para checagens rápidas de ficha e preparo do espaço.',
      'Informe alergias, sensibilidades ou medicações ativas à equipe.',
      'Evite cremes, maquiagens ou produtos que possam interferir nos procedimentos faciais.',
    ],
  },
]

const paymentRules = [
  {
    title: 'Formas de pagamento',
    points: ['Cartões, Pix e carteira digital diretamente no app.', 'Recibos fiscais disponíveis na finalização.', 'Parcelamento sujeito às condições do dia.'],
  },
  {
    title: 'Taxas e sinal',
    points: ['O sinal garante o horário e é descontado do valor total.', 'No-show ou atrasos acima de 15 min podem gerar taxa de até 50% do serviço.', 'Taxas sempre exibidas antes da confirmação.'],
  },
  {
    title: 'Transparência',
    points: ['Detalhes de valores aparecem no resumo antes de concluir.', 'Notificamos mudanças de política com antecedência.', 'Em caso de dúvidas, acione a equipe pelo suporte.'],
  },
]

const etiquette = [
  {
    title: 'Comunicação rápida',
    detail: 'Atualize seu WhatsApp e autorize lembretes para receber confirmações e avisos de agenda.',
  },
  {
    title: 'Cuidados pós-procedimento',
    detail: 'Respeite o intervalo sugerido entre sessões e siga as orientações enviadas no app.',
  },
  {
    title: 'Ambiente acolhedor',
    detail: 'Traga referências, preferências e observações. Queremos personalizar cada visita.',
  },
  {
    title: 'Dados atualizados',
    detail: 'Mantenha perfil, contatos e forma de pagamento sempre revisados para agilizar o check-in.',
  },
]

const timelineSteps = [
  {
    title: 'Escolha e confirme',
    detail: 'Selecione horário e profissional; confirme seus contatos e preferências.',
  },
  {
    title: 'Ajustes com aviso',
    detail: 'Reagende pelo app com 24h de antecedência para redistribuir a agenda.',
  },
  {
    title: 'Chegada acolhedora',
    detail: 'Chegue 10 min antes para check-in, alinhamento final e preparo do espaço.',
  },
]

export default function DashboardRulesPage() {
  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/70 via-white to-emerald-50/60" />
        <div className="absolute left-10 top-12 h-56 w-56 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="absolute bottom-10 right-16 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="space-y-8">
          <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/85 shadow-2xl backdrop-blur">
            <div className="grid gap-8 bg-gradient-to-br from-emerald-900/80 via-emerald-800/70 to-emerald-700/70 p-8 text-white sm:grid-cols-[1.25fr_1fr] sm:p-10">
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50 ring-1 ring-white/20">
                  Regras atualizadas
                </span>
                <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Experiência alinhada do agendamento ao pós-procedimento</h1>
                <p className="text-sm text-emerald-50/90 sm:text-base">
                  Criamos um conjunto de políticas com a mesma linguagem visual das outras páginas para manter o fluxo da agenda, a previsibilidade das profissionais e a sua segurança.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  {['Agenda justa', 'Transparência total', 'Cuidado contínuo'].map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50 ring-1 ring-white/15"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-white/25 bg-white/10 p-4 shadow-inner shadow-emerald-900/30 backdrop-blur sm:p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {heroHighlights.map((highlight) => (
                    <div
                      key={highlight.label}
                      className="rounded-2xl border border-white/20 bg-white/15 p-3 text-left shadow-sm shadow-emerald-900/30"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-50/90">
                        {highlight.label}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">{highlight.value}</p>
                      <p className="text-xs text-emerald-50/80">{highlight.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-emerald-50/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">Lavagem de agenda inteligente</span>
                  <span className="text-emerald-50/90">|</span>
                  <span className="text-emerald-50/90">Alertas automáticos e lembretes por WhatsApp</span>
                </div>
              </div>
            </div>

            <div className="space-y-10 p-6 sm:p-10">
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
                <section className="rounded-3xl border border-emerald-100/80 bg-white/90 p-6 shadow-lg ring-1 ring-black/5">
                  <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Fluxo ideal</p>
                      <h2 className="text-2xl font-semibold text-[#1f2d28]">Agende, confirme e adapte com leveza</h2>
                      <p className="text-sm text-[color:rgba(31,45,40,0.75)]">
                        Cards com borda, espaçamento e gradiente claros mostram a linha do tempo do seu atendimento para saber quando confirmar, ajustar ou cancelar.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-full bg-gradient-to-r from-emerald-50 to-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800 ring-1 ring-emerald-100">
                      Passos rápidos
                    </div>
                  </header>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {timelineSteps.map((step) => (
                      <article
                        key={step.title}
                        className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/60 px-4 py-3 shadow-sm ring-1 ring-black/5"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Etapa</p>
                        <h3 className="text-lg font-semibold text-[#1f2d28]">{step.title}</h3>
                        <p className="text-sm text-[color:rgba(31,45,40,0.8)]">{step.detail}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="space-y-4 rounded-3xl border border-emerald-100/80 bg-gradient-to-b from-white to-emerald-50/70 p-6 shadow-lg ring-1 ring-black/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Compromissos</p>
                      <h2 className="text-xl font-semibold text-[#1f2d28]">Transparência e cuidado contínuo</h2>
                      <p className="text-sm text-[color:rgba(31,45,40,0.78)]">
                        Segue a mesma paleta da área do cliente: vidro fosco, bordas suaves e tipografia consistente.
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-md shadow-emerald-200/80">
                      LavaBG ativa
                    </span>
                  </div>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {etiquette.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-2xl border border-emerald-100 bg-white/90 p-3 shadow-sm ring-1 ring-black/5"
                      >
                        <dt className="text-sm font-semibold text-[#1f2d28]">{item.title}</dt>
                        <dd className="text-sm text-[color:rgba(31,45,40,0.8)]">{item.detail}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>

              <section className="grid gap-6 lg:grid-cols-3">
                {policyBlocks.map((block) => (
                  <article
                    key={block.title}
                    className="relative overflow-hidden rounded-3xl border border-emerald-100/80 bg-white/92 p-6 shadow-lg ring-1 ring-black/5 backdrop-blur"
                  >
                    <div className="absolute inset-x-6 top-0 h-[2px] bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600" aria-hidden />
                    <h3 className="mt-2 text-xl font-semibold text-[#1f2d28]">{block.title}</h3>
                    <p className="mt-1 text-sm text-[color:rgba(31,45,40,0.78)]">{block.description}</p>
                    <ul className="mt-4 space-y-2 text-sm text-[color:rgba(31,45,40,0.85)]">
                      {block.items.map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <span className="mt-[6px] inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-[0_0_0_4px_rgba(16,185,129,0.08)]" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </section>

              <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <article className="rounded-3xl border border-emerald-100/80 bg-white/92 p-6 shadow-lg ring-1 ring-black/5 backdrop-blur">
                  <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Pagamentos</p>
                      <h3 className="text-xl font-semibold text-[#1f2d28]">Transações simples e seguras</h3>
                      <p className="text-sm text-[color:rgba(31,45,40,0.78)]">Opções flexíveis, recibos rápidos e visibilidade total das taxas.</p>
                    </div>
                    <span className="rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-md shadow-emerald-200/80">
                      Tema vivo
                    </span>
                  </header>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    {paymentRules.map((rule) => (
                      <div
                        key={rule.title}
                        className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/60 p-4 shadow-sm ring-1 ring-black/5"
                      >
                        <p className="text-sm font-semibold text-[#1f2d28]">{rule.title}</p>
                        <ul className="mt-2 space-y-2 text-sm text-[color:rgba(31,45,40,0.82)]">
                          {rule.points.map((point) => (
                            <li key={point} className="flex items-start gap-2">
                              <span className="mt-[6px] inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="flex flex-col justify-between gap-4 rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-emerald-900/85 via-emerald-800/85 to-emerald-700/85 p-6 text-white shadow-xl ring-1 ring-black/10">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/90">Suporte</p>
                    <h3 className="text-xl font-semibold">Conta com a gente para qualquer dúvida</h3>
                    <p className="text-sm text-emerald-50/85">
                      Vidro fosco, contornos suaves e o mesmo clima visual de Meu Perfil, Agendamentos e Procedimentos para você reconhecer que está no ambiente seguro da plataforma.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20">
                      <div className="h-10 w-10 rounded-2xl bg-white/15" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold">Equipe online</p>
                        <p className="text-xs text-emerald-50/80">Respostas rápidas pelo chat ou WhatsApp cadastrado.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20">
                      <div className="h-10 w-10 rounded-2xl bg-white/15" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold">Protocolos atualizados</p>
                        <p className="text-xs text-emerald-50/80">Notificamos ajustes de políticas antes de entrarem em vigor.</p>
                      </div>
                    </div>
                  </div>
                </article>
              </section>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
