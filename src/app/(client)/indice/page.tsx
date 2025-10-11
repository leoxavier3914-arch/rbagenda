import Link from 'next/link'

const quickLinks = [
  {
    href: '/novo-agendamento',
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
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <section className="card space-y-5">
        <div className="space-y-3">
          <span className="badge">Central rápida</span>
          <h1 className="text-3xl font-semibold text-[#1f2d28] sm:text-4xl">Índice do estúdio</h1>
          <p className="muted-text">
            Acesse rapidamente as áreas principais do aplicativo. Tudo organizado para facilitar o seu dia a dia.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <li
              key={link.href}
              className="rounded-3xl border border-white/40 bg-white/90 p-5 shadow-sm transition hover:border-white/60 hover:shadow-lg"
            >
              <h2 className="text-lg font-semibold text-[#1f2d28]">{link.title}</h2>
              <p className="mt-2 text-sm text-[color:rgba(31,45,40,0.7)]">{link.description}</p>
              <Link
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-emerald-600"
                href={link.href}
              >
                Acessar
                <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
