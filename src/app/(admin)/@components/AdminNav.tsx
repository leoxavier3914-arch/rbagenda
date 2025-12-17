"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "../adminNav.module.css";

type AdminNavProps = {
  disabled?: boolean;
  onNavigate?: () => void;
};

export const NAV_ITEMS = [
  { href: "/admin", label: "Início", description: "Resumo rápido do painel", icon: "🏠" },
  { href: "/admin/agendamentos", label: "Agendamentos", description: "Visão geral e triagem", icon: "📅" },
  { href: "/admin/filiais", label: "Filiais", description: "Unidades e timezones", icon: "🏢" },
  { href: "/admin/servicos", label: "Serviços", description: "Portfólio e preços", icon: "💼" },
  { href: "/admin/tipos", label: "Tipos", description: "Categorias e agrupamentos", icon: "🗂️" },
  { href: "/admin/clientes", label: "Clientes", description: "Base e contatos", icon: "🧑‍🤝‍🧑" },
  { href: "/admin/configuracoes", label: "Configurações", description: "Preferências do painel", icon: "⚙️" },
  { href: "/admin/suporte", label: "Suporte", description: "Em breve tickets e mensagens", icon: "💬" },
];

export default function AdminNav({ disabled, onNavigate }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Navegação do painel administrativo">
      <ul className={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""} ${disabled ? styles.navItemDisabled : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
              >
                <span className={styles.navIcon} aria-hidden>{item.icon}</span>
                <span className={styles.navCopy}>
                  <span className={styles.navTitle}>{item.label}</span>
                  <span className={styles.navSubtitle}>{item.description}</span>
                </span>
                <span className={styles.navChevron} aria-hidden>
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
