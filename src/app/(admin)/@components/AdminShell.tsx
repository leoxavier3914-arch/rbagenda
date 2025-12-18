"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

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
  const router = useRouter();
  const { status, role } = useAdminGuard();
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

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
  const brandTitle = currentNav?.label ?? "Painel";
  const shouldShowBrandTitle = brandTitle.toLowerCase() !== "dashboard";
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
    const targetNode = event.target as Node;
    const clickedSidebar = sidebarRef.current?.contains(targetNode);
    const clickedUserMenu = userMenuRef.current?.contains(targetNode);

    if (!clickedSidebar) {
      setSidebarExpanded(false);
      setMobileMenuOpen(false);
    }

    if (!clickedUserMenu) {
      setUserMenuOpen(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erro ao sair:", error.message);
    }
    setUserMenuOpen(false);
    router.replace("/login");
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
            <div className={styles.brandMark} aria-label="PAINELADM">
            <span className={styles.brandMarkPrimary}>PAINEL</span>
            <span className={styles.brandMarkAccent}>ADM</span>
          </div>
          {shouldShowBrandTitle ? <p className={styles.brandTitle}>{brandTitle}</p> : null}
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
          <div className={styles.userMenu} ref={userMenuRef}>
            <button
              type="button"
              className={`${styles.userChip} ${userMenuOpen ? styles.userChipOpen : ""}`}
              aria-label="Usuário logado"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen((prev) => !prev)}
            >
              <span className={styles.avatar}>{initials}</span>
              <div className={styles.userMeta}>
                <span className={styles.userName}>{profile?.name ?? "Administrador"}</span>
                <span className={styles.userRole}>{profile?.role ?? role ?? "admin"}</span>
              </div>
            </button>
            {userMenuOpen ? (
              <div className={styles.userDropdown} role="menu">
                <button type="button" className={styles.userDropdownItem} onClick={handleSignOut}>
                  Sair
                </button>
              </div>
            ) : null}
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
