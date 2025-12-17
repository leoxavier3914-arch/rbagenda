"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { supabase } from "@/lib/db";

import AdminNav, { NAV_ITEMS } from "./AdminNav";
import { useAdminGuard } from "../useAdminGuard";
import styles from "../adminShell.module.css";

type ProfileInfo = {
  name: string;
  email: string;
  role?: string | null;
};

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, role } = useAdminGuard();
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email, role")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      setProfile({
        name: profileData?.full_name ?? data.user?.email ?? "Administrador",
        email: profileData?.email ?? data.user?.email ?? "",
        role: (profileData?.role as string | null) ?? role,
      });
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 900px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
      setMobileMenuOpen(false);
    };

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const expanded = sidebarExpanded || mobileMenuOpen;
  const initials = useMemo(() => profile?.name?.slice(0, 2).toUpperCase() ?? "AD", [profile?.name]);

  const currentNav = useMemo(() => {
    return NAV_ITEMS.find((item) => item.href && pathname.startsWith(item.href)) ?? NAV_ITEMS[0];
  }, [pathname]);
  const sidebarClassName = [
    styles.sidebar,
    expanded ? styles.sidebarExpanded : styles.sidebarCollapsed,
    mobileMenuOpen ? styles.sidebarMobileOpen : "",
  ].join(" ");

  const handleSidebarClick = () => {
    if (!expanded && isDesktop) {
      setSidebarExpanded(true);
    }
  };

  const handleRootClick = (event: React.MouseEvent) => {
    if (sidebarRef.current?.contains(event.target as Node)) return;
    setSidebarExpanded(false);
    setMobileMenuOpen(false);
  };

  return (
    <div className={styles.adminRoot} data-expanded={expanded} onClickCapture={handleRootClick}>
      {mobileMenuOpen && !isDesktop ? (
        <div className={styles.backdrop} onClick={() => setMobileMenuOpen(false)} aria-hidden />
      ) : null}

      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button
            type="button"
            className={styles.hamburger}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu lateral"
            aria-expanded={mobileMenuOpen}
            aria-controls="admin-menu"
          >
            <span />
            <span />
            <span />
          </button>
          <div className={styles.brandArea}>
            <div className={styles.brandIcon} aria-hidden>
              <span>🗂️</span>
            </div>
            <div>
              <p className={styles.breadcrumb}>Dashboard</p>
              <p className={styles.brandTitle}>{currentNav?.label ?? "Painel"}</p>
            </div>
          </div>
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.searchBox} role="search">
            <input type="search" placeholder="Buscar" aria-label="Buscar" />
            <span aria-hidden>🔍</span>
          </div>
          <button type="button" className={styles.iconAction} aria-label="Notificações">
            🔔
          </button>
          <button type="button" className={styles.iconAction} aria-label="Mensagens">
            💬
          </button>
          <div className={styles.userChip} aria-label="Usuário logado">
            <span className={styles.avatar}>{initials}</span>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{profile?.name ?? "Administrador"}</span>
              <span className={styles.userRole}>{profile?.role ?? role ?? "admin"}</span>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <aside
          id="admin-menu"
          className={sidebarClassName}
          ref={sidebarRef}
          onClick={handleSidebarClick}
        >
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarUser}>
              <span className={styles.avatarLarge}>{initials}</span>
              <div className={styles.sidebarUserMeta}>
                <p>{profile?.name ?? "Administrador"}</p>
                <span>{profile?.email ?? "Conta interna"}</span>
              </div>
            </div>
          </div>

          <AdminNav
            expanded={expanded}
            disabled={status !== "authorized"}
            onExpand={() => setSidebarExpanded(true)}
            onNavigate={() => {
              setSidebarExpanded(false);
              setMobileMenuOpen(false);
            }}
          />
        </aside>

        <main className={styles.contentArea}>
          <div className={styles.pageShell}>{children}</div>
        </main>
      </div>
    </div>
  );
}
