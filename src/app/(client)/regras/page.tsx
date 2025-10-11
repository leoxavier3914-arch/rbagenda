const rules = [
  {
    title: 'Prazos para reagendamento',
    description:
      'Reagendamentos podem ser feitos com até 24 horas de antecedência diretamente pelo aplicativo.',
  },
  {
    title: 'Pontualidade',
    description:
      'Chegue com 5 minutos de antecedência para garantir todo o tempo necessário ao seu atendimento.',
  },
  {
    title: 'Política de cancelamento',
    description:
      'Cancelamentos com menos de 12 horas podem gerar cobrança de taxa para mantermos nossa agenda equilibrada.',
  },
]

export default function DashboardRulesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <section className="card space-y-5">
        <div className="space-y-3">
          <span className="badge">Boas práticas</span>
          <h1 className="text-3xl font-semibold text-[#1f2d28] sm:text-4xl">Regras do estúdio</h1>
          <p className="muted-text">
            Combinados simples ajudam a manter uma experiência suave para todas as clientes. Revise sempre que precisar.
          </p>
        </div>
        <ol className="space-y-3 text-sm text-[color:rgba(31,45,40,0.75)]">
          {rules.map((rule, index) => (
            <li
              key={rule.title}
              className="rounded-3xl border border-white/40 bg-white/90 p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Regra {index + 1}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[#1f2d28]">{rule.title}</h2>
              <p className="mt-2">{rule.description}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
