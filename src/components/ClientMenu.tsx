"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { supabase } from "@/lib/db";

import styles from "./ClientMenu.module.css";

type DatabaseRole = "client" | "admin" | "adminmaster" | "adminsuper" | null;
type AppRole = "client" | "admin" | "adminsuper";

type ProfileState = {
  name: string | null;
  role: AppRole;
  isLoading: boolean;
};

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  icon: ReactElement;
};

type ClientMenuProps = {
  children: ReactNode;
};

const roleLabels: Record<AppRole, string> = {
  client: "Cliente",
  admin: "Admin",
  adminsuper: "Admin Super",
};

const normalizeRole = (role: DatabaseRole): AppRole => {
  if (role === "admin") return "admin";
  if (role === "adminsuper" || role === "adminmaster") return "adminsuper";
  return "client";
};

const getInitials = (value: string | null): string => {
  if (!value) return "RB";
  const trimmed = value.trim();
  if (!trimmed) return "RB";
  const parts = trimmed.split(/\s+/u).filter(Boolean);
  if (parts.length === 1) {
    return parts[0]?.[0]?.toUpperCase() ?? "RB";
  }
  const [first, last] = [parts[0], parts[parts.length - 1]];
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
};

const CalendarIcon = () => (
  <svg
    className={styles.icon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M7 2v3M17 2v3M3 9h18" />
    <path d="M5 12h4M5 16h4M13 12h6M13 16h6" />
    <rect x={3} y={5} width={18} height={16} rx={3} ry={3} />
  </svg>
);

const PlusIcon = () => (
  <svg
    className={styles.icon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const ProfileIcon = () => (
  <svg
    className={styles.icon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
    <path d="M4 20.4a8 8 0 0 1 16 0" />
  </svg>
);

const ShieldIcon = () => (
  <svg
    className={styles.icon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 3 5 5v6a11 11 0 0 0 7 10 11 11 0 0 0 7-10V5Z" />
    <path d="M9 11.5 11 14l4-4" />
  </svg>
);

const DiamondIcon = () => (
  <svg
    className={styles.icon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="m12 3-7 7 7 11 7-11-7-7Z" />
    <path d="M5 10h14" />
    <path d="M12 3v18" />
  </svg>
);

const MenuIcon = () => (
  <svg
    className={styles.icon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const SupportIcon = () => (
  <svg
    className={styles.icon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
    <path d="M12 17h.01M11 11a1 1 0 0 1 2 0c0 .7-.4 1-1 1s-1 .3-1 1v.5" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    className={styles.icon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.3}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 15.5a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 15.5Z" />
    <path d="M20 12a7.9 7.9 0 0 0-.12-1l2-1.55-2-3.46-2.41.65a8.06 8.06 0 0 0-1.73-1L13.5 2h-3L9 4.69a8.06 8.06 0 0 0-1.73 1L4.8 6l-2 3.46L4.8 11A7.9 7.9 0 0 0 4.68 12a7.9 7.9 0 0 0 .12 1l-2 1.55 2 3.46 2.41-.65a8.06 8.06 0 0 0 1.73 1L10.5 22h3l1.5-2.69a8.06 8.06 0 0 0 1.73-1l2.41.65 2-3.46-2-1.55c.08-.33.12-.66.12-1Z" />
  </svg>
);

export default function ClientMenu({ children }: ClientMenuProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileState>({
    name: null,
    role: "client",
    isLoading: true,
  });

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session?.user?.id) {
          if (!active) return;
          setProfile({ name: null, role: "client", isLoading: false });
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!active) return;

        setProfile({
          name: profileData?.full_name ?? session.user.email ?? null,
          role: normalizeRole(profileData?.role ?? null),
          isLoading: false,
        });
      } catch (error) {
        console.error("Falha ao carregar informações do perfil", error);
        if (!active) return;
        setProfile({ name: null, role: "client", isLoading: false });
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const previousOverflowY = document.body.style.overflowY;
    document.body.style.overflowY = "hidden";
    return () => {
      document.body.style.overflowY = previousOverflowY;
    };
  }, [isMenuOpen]);

  const primaryItems = useMemo<NavItem[]>(
    () => [
      { href: "/dashboard", label: "Meu perfil", exact: true, icon: <ProfileIcon /> },
      {
        href: "/dashboard/novo-agendamento",
        label: "Novo agendamento",
        icon: <PlusIcon />,
      },
      {
        href: "/dashboard/agendamentos",
        label: "Meus agendamentos",
        icon: <CalendarIcon />,
      },
    ],
    [],
  );

  const adminItems = useMemo<NavItem[]>(() => {
    if (profile.role === "admin") {
      return [
        {
          href: "/admin",
          label: "Admin",
          icon: <ShieldIcon />,
        },
      ];
    }

    if (profile.role === "adminsuper") {
      return [
        {
          href: "/admin/adminsuper",
          label: "Admin Super",
          icon: <DiamondIcon />,
        },
      ];
    }

    return [];
  }, [profile.role]);

  const knowledgeItems = useMemo<NavItem[]>(
    () => [
      {
        href: "/dashboard/indice",
        label: "Índice",
        icon: <MenuIcon />,
      },
      { href: "/dashboard/regras", label: "Regras", icon: <MenuIcon /> },
    ],
    [],
  );

  const supportItems = useMemo<NavItem[]>(
    () => [
      { href: "/dashboard/suporte", label: "Suporte", icon: <SupportIcon /> },
      {
        href: "/dashboard/configuracoes",
        label: "Configurações",
        icon: <SettingsIcon />,
      },
    ],
    [],
  );

  const sections = useMemo(
    () => [
      { id: "primary", items: primaryItems },
      { id: "admin", items: adminItems },
      { id: "knowledge", items: knowledgeItems },
      { id: "support", items: supportItems },
    ],
    [adminItems, knowledgeItems, primaryItems, supportItems],
  );

  const navElements = useMemo(() => {
    return sections.reduce<ReactElement[]>((elements, section) => {
      if (section.items.length === 0) {
        return elements;
      }

      if (elements.length > 0) {
        elements.push(
          <div key={`${section.id}-divider`} className={styles.divider} />,
        );
      }

      section.items.forEach((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        elements.push(
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>,
        );
      });

      return elements;
    }, []);
  }, [pathname, sections]);

  const roleSubtitle = profile.isLoading ? "Carregando…" : roleLabels[profile.role];
  const displayName = profile.isLoading
    ? "Olá"
    : profile.name ?? "Romeike Beauty";
  const initials = getInitials(profile.name);

  const toggleMenu = () => {
    setIsMenuOpen((open) => !open);
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.hamburger}
        id="client-menu-button"
        aria-expanded={isMenuOpen}
        aria-controls="client-menu-sidebar"
        onClick={toggleMenu}
      >
        <span className={styles.bars}>
          <span className={styles.bar} />
          <span className={styles.bar} />
          <span className={styles.bar} />
        </span>
        <span className="sr-only">{isMenuOpen ? "Fechar menu" : "Abrir menu"}</span>
      </button>

      <div
        className={`${styles.overlay} ${isMenuOpen ? styles.overlayActive : ""}`}
        role="presentation"
        onClick={closeMenu}
      />

      <aside
        id="client-menu-sidebar"
        className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarActive : ""}`}
        aria-label="Menu principal"
      >
        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden>
            {initials}
          </span>
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>
              <span>{displayName}</span>
              <svg
                className={styles.diamondIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={1.5}
                aria-hidden
              >
                <path d="M12 2 3 9l9 13 9-13-9-7Z" />
                <path d="M3 9h18" />
                <path d="M12 2v20" />
              </svg>
            </div>
            <div className={styles.profileSub}>{roleSubtitle}</div>
          </div>
        </div>

        <div className={styles.divider} />

        <nav className={styles.menu} aria-label="Navegação">
          {navElements}
        </nav>
      </aside>

      <main className={styles.content}>
        <div className={styles.contentInner}>{children}</div>
      </main>
    </div>
  );
}
