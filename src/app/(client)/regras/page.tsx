const ruleCards = [
  {
    title: 'Agendamento',
    description:
      'Escolha a data e o profissional com antecedência para garantir os horários mais disputados.',
    points: [
      'Confirme seu contato e preferências ao reservar.',
      'Compartilhe observações importantes no campo de comentários.',
      'Chegue 5 minutos antes para iniciar no horário combinado.',
    ],
  },
  {
    title: 'Procedimento',
    description:
      'Queremos que você aproveite cada minuto. Siga as orientações do pré e pós-atendimento.',
    points: [
      'Evite cremes ou maquiagens antes de procedimentos faciais.',
      'Informe alergias, sensibilidades ou medicações ativas.',
      'Respeite o tempo de descanso sugerido entre sessões.',
    ],
  },
  {
    title: 'Cancelamento',
    description:
      'Desmarque com antecedência para mantermos a agenda equilibrada e oferecer o horário a outra cliente.',
    points: [
      'Cancelamentos em até 12 horas: sem cobrança adicional.',
      'Após 12 horas do horário marcado, pode haver retenção do sinal.',
      'Ausências sem aviso podem gerar bloqueio temporário de novos horários.',
    ],
  },
  {
    title: 'Reagendamento',
    description:
      'Precisa ajustar o horário? Sem problemas, fazemos o possível para acomodar.',
    points: [
      'Solicite com, no mínimo, 24 horas de antecedência.',
      'Use o app para escolher outro horário disponível imediatamente.',
      'Mudanças repetidas em curto prazo podem limitar novas remarcações.',
    ],
  },
  {
    title: 'Taxas',
    description:
      'Aplicamos taxas apenas para manter a agenda sustentável para todos.',
    points: [
      'No-show ou atraso superior a 15 minutos podem gerar taxa de 50% do valor do serviço.',
      'Valores de sinal são abatidos do total no dia do atendimento.',
      'Taxas são sempre informadas antes da confirmação.',
    ],
  },
  {
    title: 'Pagamentos',
    description:
      'Oferecemos flexibilidade para você escolher como prefere pagar.',
    points: [
      'Aceitamos cartões, Pix e carteira digital pelo app.',
      'Sinais podem ser pagos online para garantir a reserva.',
      'Solicite recibo fiscal diretamente pelo aplicativo.',
    ],
  },
]

const quickTips = [
  'Mantenha seu WhatsApp atualizado para receber lembretes.',
  'Atualize seu perfil para personalizarmos as recomendações.',
  'Notou algum imprevisto? Avise o quanto antes pelo app.',
]

export default function DashboardRulesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <section className="card space-y-6">
        <div className="space-y-3">
          <span className="badge">Boas práticas</span>
          <h1 className="text-3xl font-semibold text-[#1f2d28] sm:text-4xl">Regras do estúdio</h1>
          <p className="muted-text">
            Organizamos nossas diretrizes para que sua experiência seja leve do agendamento ao pós-procedimento. Revise
            sempre que precisar e conte com a equipe para qualquer dúvida.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {ruleCards.map((rule) => (
            <article
              key={rule.title}
              className="rounded-3xl border border-white/40 bg-white/90 p-5 shadow-sm transition hover:border-white/60 hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#1f2d28]">{rule.title}</h2>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Regra
                </span>
              </div>
              <p className="mt-2 text-sm text-[color:rgba(31,45,40,0.75)]">{rule.description}</p>
              <ul className="mt-3 space-y-2 text-sm text-[color:rgba(31,45,40,0.8)]">
                {rule.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/70 p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Dicas rápidas</p>
              <p className="text-lg font-semibold text-[#1f2d28]">Como aproveitar melhor seus horários</p>
            </div>
            <span className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Sempre atualizado
            </span>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {quickTips.map((tip) => (
              <li
                key={tip}
                className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-[color:rgba(31,45,40,0.85)]"
              >
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
