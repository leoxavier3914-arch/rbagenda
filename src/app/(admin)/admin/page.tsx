import Link from "next/link";

import styles from "../adminHome.module.css";

const SECTIONS = [
  { href: "/admin/agendamentos", title: "Agendamentos", description: "Triagem por status e visão rápida das reservas.", icon: "📅" },
  { href: "/admin/filiais", title: "Filiais", description: "Configure unidades e fuso horário do estúdio.", icon: "🏢" },
  { href: "/admin/servicos", title: "Serviços", description: "Portfólio, preços e duração dos procedimentos.", icon: "💼" },
  { href: "/admin/tipos", title: "Tipos", description: "Categorias de serviço para organizar ofertas.", icon: "🗂️" },
  { href: "/admin/clientes", title: "Clientes", description: "Base de clientes e contatos principais.", icon: "🧑‍🤝‍🧑" },
  { href: "/admin/configuracoes", title: "Configurações", description: "Preferências gerais do painel e automações.", icon: "⚙️" },
  { href: "/admin/suporte", title: "Suporte (em breve)", description: "Espaço reservado para mensagens e tickets.", icon: "💬" },
];

export default function AdminHomePage() {
  return (
    <div className={styles.wrapper}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Painel Admin</span>
        <h2 className={styles.title}>Escolha um módulo para começar</h2>
        <p className={styles.subtitle}>
          Acesso rápido às áreas de agendamento, catálogo e clientes. Use o menu lateral para navegar entre os módulos do painel.
        </p>
      </section>

      <div className={styles.cards}>
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} className={styles.card}>
            <span className={styles.cardIcon} aria-hidden>
              {section.icon}
            </span>
            <div>
              <p className={styles.cardTitle}>{section.title}</p>
              <p className={styles.cardDescription}>{section.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
