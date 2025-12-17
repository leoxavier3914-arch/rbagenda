"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { type AdminRole } from "../useAdminGuard";

import styles from "../adminNav.module.css";

type AdminNavProps = {
  disabled?: boolean;
  role?: AdminRole | null;
};

type NavItem = { href: string; label: string; description: string; icon: string };

const NAV_ITEMS: Record<AdminRole, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Admin", description: "Início do painel", icon: "🏠" },
    { href: "/admin/filiais", label: "Filiais", description: "Filial ativa e horário", icon: "🏢" },
    { href: "/admin/agendamentos", label: "Agendamentos", description: "Reservas da filial", icon: "📅" },
    { href: "/admin/clientes", label: "Clientes", description: "Clientes por filial", icon: "🧑‍🤝‍🧑" },
  ],
  adminsuper: [
    { href: "/admin/adminsuper", label: "Admin super", description: "Resumo do painel", icon: "🛰️" },
    { href: "/admin/adminsuper/filiais", label: "Filiais", description: "Filiais que você lidera", icon: "🏢" },
    { href: "/admin/adminsuper/admins", label: "Admins", description: "Vincular admins às filiais", icon: "🧑‍💼" },
    { href: "/admin/adminsuper/agendamentos", label: "Agendamentos", description: "Reservas das suas filiais", icon: "📅" },
    { href: "/admin/adminsuper/clientes", label: "Clientes", description: "Clientes atendidos", icon: "🧑‍🤝‍🧑" },
  ],
  adminmaster: [
    { href: "/admin/adminmaster", label: "Admin master", description: "Visão global", icon: "🌐" },
    { href: "/admin/adminmaster/filiais", label: "Filiais", description: "Todas as filiais", icon: "🏢" },
    { href: "/admin/adminmaster/supers", label: "Supers", description: "Gerenciar cargos", icon: "🧭" },
    { href: "/admin/adminmaster/auditoria", label: "Auditoria", description: "Eventos recentes", icon: "🔍" },
  ],
};

export default function AdminNav({ disabled, role }: AdminNavProps) {
  const pathname = usePathname();
  const navItems = role ? NAV_ITEMS[role] : [];

  return (
    <nav className={styles.nav} aria-label="Navegação do painel administrativo">
      <ul className={styles.navList}>
        {navItems.length === 0 ? (
          <li>
            <span className={`${styles.navItem} ${styles.navItemDisabled}`}>Carregando navegação...</span>
          </li>
        ) : null}
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""} ${disabled ? styles.navItemDisabled : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={styles.navIcon} aria-hidden>{item.icon}</span>
                <span className={styles.navCopy}>
                  <span className={styles.navTitle}>{item.label}</span>
                  <span className={styles.navSubtitle}>{item.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
