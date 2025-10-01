const contactOptions = [
  {
    title: 'Whatsapp',
    description: 'Dúvidas rápidas ou ajustes de agenda? Fale direto conosco.',
    value: '(11) 99999-9999',
  },
  {
    title: 'E-mail',
    description: 'Envie informações detalhadas ou anexos para nossa equipe.',
    value: 'contato@romeikebeauty.com',
  },
  {
    title: 'Horário de atendimento',
    description: 'Segunda a sábado, das 9h às 19h. Sempre com muito carinho por aqui.',
    value: 'Respostas em até 1 dia útil',
  },
]

export default function DashboardSupportPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <section className="card space-y-5">
        <div className="space-y-3">
          <span className="badge">Estamos por perto</span>
          <h1 className="text-3xl font-semibold text-[#1f2d28] sm:text-4xl">Suporte</h1>
          <p className="muted-text">
            Precisa de ajuda? Escolha o canal que preferir. Nossa equipe responde com carinho e agilidade.
          </p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {contactOptions.map((option) => (
            <div
              key={option.title}
              className="rounded-3xl border border-white/40 bg-white/90 p-5 shadow-sm"
            >
              <dt className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {option.title}
              </dt>
              <dd className="mt-2 text-lg font-semibold text-[#1f2d28]">{option.value}</dd>
              <p className="mt-2 text-sm text-[color:rgba(31,45,40,0.7)]">{option.description}</p>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
