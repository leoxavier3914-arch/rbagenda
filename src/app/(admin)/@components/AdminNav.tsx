"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "../adminNav.module.css";

type AdminNavProps = {
  expanded: boolean;
  disabled?: boolean;
  onExpand?: () => void;
  onNavigate?: () => void;
};

type NavItem = {
  href?: string;
  label: string;
  icon: string;
  comingSoon?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { label: "Agendamentos", icon: "📅", comingSoon: true },
  { label: "Clientes", icon: "👥", comingSoon: true },
  { label: "Tickets", icon: "🎫", comingSoon: true },
  { label: "Relatórios", icon: "📊", comingSoon: true },
  { label: "Configurações", icon: "⚙️", comingSoon: true },
];

export default function AdminNav({ expanded, disabled, onExpand, onNavigate }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav id="admin-nav" className={`${styles.nav} ${expanded ? styles.navExpanded : styles.navCollapsed}`} aria-label="Menu do painel">
      <ul className={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.href ? pathname === item.href : false;

          const content = (
            <>
              <span className={styles.navIcon} aria-hidden>
                {item.icon}
              </span>
              <span className={styles.navLabel}>{item.label}</span>
              {expanded && item.comingSoon ? <span className={styles.navBadge}>Em breve</span> : null}
            </>
          );

          if (item.href && !item.comingSoon) {
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ""} ${disabled ? styles.navItemDisabled : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => {
                    if (!expanded) onExpand?.();
                    onNavigate?.();
                  }}
                >
                  {content}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.label}>
              <button
                type="button"
                className={`${styles.navItem} ${styles.navButton} ${disabled ? styles.navItemDisabled : ""}`}
                onClick={() => onExpand?.()}
                disabled={disabled}
                aria-label={item.label}
              >
                {content}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
