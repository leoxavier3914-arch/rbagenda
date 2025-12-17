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

  const toggleTheme = () => {
    const currentIndex = presets.findIndex((preset) => preset.id === theme);
    const next = presets[(currentIndex + 1) % presets.length];
    setTheme(next.id);
  };

  const isChecking = status === "checking";

  return (
    <AdminBranchProvider>
      <div className={styles.appShell}>
        <div className={styles.inner}>
          {isMenuOpen ? <div className={styles.sidebarBackdrop} onClick={() => setIsMenuOpen(false)} aria-hidden /> : null}
          <aside className={`${styles.sidebarWrapper} ${isMenuOpen ? styles.sidebarOpen : ""}`}>
            <div className={styles.sidebar}>
              <div className={styles.brand}>
                <div className={styles.brandMark}>RB</div>
                <div className={styles.brandCopy}>
                  <p className={styles.brandName}>Admin Agenda</p>
                  <p className={styles.brandSubtitle}>Operações e catálogo</p>
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
            </div>
          </aside>
          <main className={styles.main}>
            <div className={styles.contentFrame}>
              <div className={styles.topbar}>
                <button
                  type="button"
                  className={styles.menuButton}
                  onClick={() => setIsMenuOpen(true)}
                  aria-expanded={isMenuOpen}
                  aria-controls="admin-nav"
                >
                  ☰
                </button>
                <div className={styles.pageTitle}>
                  <h1>{currentNav?.label ?? "Painel administrativo"}</h1>
                  <p>{currentNav?.description ?? "Gerencie operações do estúdio."}</p>
                </div>
                <BranchSelector />
              </div>
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminBranchProvider>
  );
}
