"use client";

import Link from "next/link";
import { useMemo } from "react";

import { AdminCard, AdminStatCard } from "../@components/AdminUI";
import styles from "../adminHome.module.css";
import { useAdminGuard } from "../useAdminGuard";

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
  const { status } = useAdminGuard({
    allowedRoles: ["admin"],
    fallbackRedirects: {
      adminsuper: "/admin/adminsuper",
      adminmaster: "/admin/adminmaster",
      client: "/login",
      unauthenticated: "/login",
    },
  });

  const isAuthorized = status === "authorized";

  const sections = useMemo(() => SECTIONS, []);

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.heroGrid}>
        <AdminCard
          title="Painel administrativo"
          description="Acesse rapidamente cada módulo sem alterar fluxos ou permissões. O novo layout mantém todas as rotas originais."
        >
          <div className={styles.heroBody}>
            <p>
              Sidebar fixa no desktop, drawer no mobile e um frame limpo para todas as páginas do admin. Escolha um módulo
              para continuar trabalhando sem perder contexto.
            </p>
            <ul className={styles.heroList}>
              <li>Rotas preservadas (/admin/...)</li>
              <li>Permissões admin/adminsuper/adminmaster mantidas</li>
              <li>Temas dedicados só para o painel administrativo</li>
            </ul>
          </div>
        </AdminCard>
        <div className={styles.statGrid}>
          <AdminStatCard label="Módulos" value={sections.length} hint="Todas as rotas do admin ativas" icon="🗂️" />
          <AdminStatCard label="Layout" value="Novo shell" hint="Sidebar fixa + drawer mobile" icon="🧭" />
          <AdminStatCard label="Temas" value="4 presets" hint="Light, Dark, Romeike, White Label" icon="🎨" />
        </div>
      </div>

      <AdminCard title="Escolha um módulo" description="Cards limpos com ícones para navegar no painel.">
        <div className={styles.cards}>
          {sections.map((section) => (
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
      </AdminCard>
    </div>
  );
}
