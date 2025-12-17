"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { supabase } from "@/lib/db";

import AdminNav, { NAV_ITEMS } from "./AdminNav";
import { AdminBranchProvider, useAdminBranch } from "./AdminBranchContext";
import { useAdminGuard } from "../useAdminGuard";
import { useAdminTheme } from "./AdminThemeProvider";
import styles from "../adminShell.module.css";

type ProfileInfo = {
  name: string;
  email: string;
};

function BranchSelector() {
  const { branches, activeBranchId, setActiveBranchId, branchScope, setBranchScope, loading, isMaster } =
    useAdminBranch();

  const selectValue = useMemo(() => {
    if (branchScope === "branch") return activeBranchId ?? "";
    if (branchScope === "no_branch") return "__NO_BRANCH__";
    return "";
  }, [activeBranchId, branchScope]);

  return (
    <label className={styles.branchSelector}>
      <span className="sr-only">Filtrar por filial</span>
      <select
        className={styles.selectControl}
        value={selectValue}
        disabled={loading || branches.length === 0}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "__NO_BRANCH__") {
            setActiveBranchId(null);
            setBranchScope("no_branch");
            return;
          }

          if (!value) {
            setActiveBranchId(null);
            setBranchScope("none");
            return;
          }

          setActiveBranchId(value);
          setBranchScope("branch");
        }}
      >
        <option value="">{loading ? "Carregando filiais…" : "Selecione uma filial"}</option>
        {isMaster ? <option value="__NO_BRANCH__">Tickets sem filial</option> : null}
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name || "Filial"}
          </option>
        ))}
      </select>
    </label>
  );
}

function UserCard({ profile, role }: { profile: ProfileInfo | null; role: string | null }) {
  const initials = useMemo(() => profile?.name?.slice(0, 2).toUpperCase() || "AD", [profile?.name]);
  const roleCopy = role ? role.replace("admin", "admin ").trim() : "admin";

  return (
    <div className={styles.userCard}>
      <span className={styles.userAvatar} aria-hidden>
        {initials}
      </span>
      <div className={styles.userCopy}>
        <p className={styles.userName}>{profile?.name || "Administrador"}</p>
        <p className={styles.userRole}>{profile?.email || "Conta interna"}</p>
        <p className={styles.userRole}>Perfil: {roleCopy}</p>
      </div>
    </div>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const { status, role } = useAdminGuard();
  const { theme, setTheme, presets } = useAdminTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;
      const fallbackEmail = data.user?.email ?? "";
      setProfile({
        name: profileData?.full_name ?? fallbackEmail,
        email: profileData?.email ?? fallbackEmail,
      });
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const currentNav = useMemo(() => NAV_ITEMS.find((item) => pathname.startsWith(item.href)), [pathname]);

  const initials = useMemo(() => profile?.name?.slice(0, 2).toUpperCase() || "AD", [profile?.name]);

  const toggleTheme = () => {
    const currentIndex = presets.findIndex((preset) => preset.id === theme);
    const next = presets[(currentIndex + 1) % presets.length];
    setTheme(next.id);
  };

  const isChecking = status === "checking";

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMenuOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <AdminBranchProvider>
      <div className={styles.adminRoot}>
        {isMenuOpen ? <div className={styles.drawerBackdrop} onClick={() => setIsMenuOpen(false)} aria-hidden /> : null}

        <header className={styles.adminHeader}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setIsMenuOpen(true)}
              aria-expanded={isMenuOpen}
              aria-controls="admin-nav"
              aria-label="Abrir menu lateral"
            >
              ☰
            </button>
            <div className={styles.brandMark} aria-hidden>
              RB
            </div>
            <div className={styles.brandCopy}>
              <p className={styles.brandName}>RB Admin</p>
              <p className={styles.brandSubtitle}>Painel operacional</p>
            </div>
            <div className={styles.headerBreadcrumbs} aria-label="Breadcrumb">
              <span className={styles.breadcrumbRoot}>Admin</span>
              <span className={styles.breadcrumbDivider} aria-hidden>
                /
              </span>
              <span className={styles.breadcrumbCurrent}>{currentNav?.label ?? "Painel"}</span>
            </div>
          </div>

          <div className={styles.headerRight}>
            <BranchSelector />
            <button type="button" className={styles.themeButton} onClick={toggleTheme} aria-label="Alternar tema do painel">
              🎨
            </button>
            <button type="button" className={styles.userMenu} aria-label={`Conta ${profile?.name ?? "Administrador"}`}>
              <span className={styles.userAvatarSmall} aria-hidden>
                {initials}
              </span>
              <span className={styles.userMeta}>
                <span className={styles.userName}>{profile?.name || "Administrador"}</span>
                <span className={styles.userRole}>{profile?.email || "Conta interna"}</span>
              </span>
              <span className={styles.userCaret} aria-hidden>
                ▾
              </span>
            </button>
          </div>
        </header>

        <div className={styles.adminBody}>
          <aside className={`${styles.adminSidebar} ${isMenuOpen ? styles.sidebarOpen : ""}`} aria-label="Menu do painel administrativo">
            <div className={styles.sidebarHeader}>
              <div className={styles.headerLeft}>
                <div className={styles.brandMark} aria-hidden>
                  RB
                </div>
                <div className={styles.brandCopy}>
                  <p className={styles.brandName}>Admin Agenda</p>
                  <p className={styles.brandSubtitle}>Navegue pelo painel</p>
                </div>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setIsMenuOpen(false)} aria-label="Fechar navegação">
                ✕
              </button>
            </div>
            <AdminNav disabled={isChecking} onNavigate={() => setIsMenuOpen(false)} />
            <div className={styles.sidebarFooter}>
              <UserCard profile={profile} role={role} />
              <div className={styles.inlineActions}>
                <button type="button" className={styles.closeButton} onClick={toggleTheme} aria-label="Alternar tema do painel">
                  🎨
                </button>
              </div>
            </div>
          </aside>

          <main className={styles.adminContent}>
            <div className={styles.pageHeader}>
              <div className={styles.pageTitle}>
                <h1>{currentNav?.label ?? "Painel administrativo"}</h1>
                <p>{currentNav?.description ?? "Gerencie operações do estúdio."}</p>
              </div>
              <div className={styles.pageActions}>
                <button type="button" className={styles.iconButton} onClick={toggleTheme} aria-label="Alternar tema do painel">
                  🎨
                </button>
              </div>
            </div>
            <div className={styles.pageContent}>{children}</div>
          </main>
        </div>
      </div>
    </AdminBranchProvider>
  );
}
