"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/db";

import AdminNav from "./AdminNav";
import { AdminBranchProvider, useAdminBranch } from "./AdminBranchContext";
import { useAdminGuard, type AdminRole } from "../useAdminGuard";
import { useAdminTheme } from "./AdminThemeProvider";
import styles from "../admin.module.css";

type ProfileSummary = {
  name: string | null;
  email: string | null;
  role: AdminRole | "client" | null;
};

function BranchSelector() {
  const { branches, activeBranchId, setActiveBranchId, branchScope, setBranchScope, loading, isMaster } =
    useAdminBranch();

  const hasBranches = branches.length > 0;
  const selectValue =
    branchScope === "branch" ? activeBranchId ?? "" : branchScope === "no_branch" ? "__NO_BRANCH__" : "";

  return (
    <div className={styles.branchSelector}>
      <div className={styles.sectionLabel}>
        <span>Filiais</span>
        <p className={styles.sectionHint}>{loading ? "Carregando..." : hasBranches ? "Selecione a filial ativa" : "Nenhuma filial cadastrada"}</p>
      </div>
      <div className={styles.branchInputs}>
        <label className={styles.inputLabel} htmlFor="admin-active-branch">
          Filial ativa
        </label>
        <select
          id="admin-active-branch"
          className={styles.select}
          value={selectValue}
          disabled={loading || !hasBranches}
          onChange={(event) => {
            const { value } = event.target;

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
          <option value="">Selecione uma filial</option>
          {isMaster ? <option value="__NO_BRANCH__">Tickets sem filial</option> : null}
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name || "Filial"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function useProfileSummary(role: AdminRole | "client" | null) {
  const [profile, setProfile] = useState<ProfileSummary | null>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const { data: userResponse } = await supabase.auth.getUser();
      const userId = userResponse?.user?.id;

      if (!userId) {
        if (active) setProfile(null);
        return;
      }

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name, email, role")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      setProfile({
        name: profileRow?.full_name ?? profileRow?.email ?? userResponse.user.email ?? null,
        email: profileRow?.email ?? userResponse.user.email ?? null,
        role: (profileRow?.role as AdminRole | "client" | null) ?? role,
      });
    };

    void loadProfile();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });

    return () => {
      active = false;
      subscription?.subscription.unsubscribe();
    };
  }, [role]);

  return profile;
}

function initialsFromName(name: string | null): string {
  if (!name) return "ADM";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function AdminShellContent({ children }: { children: ReactNode }) {
  const { status, role } = useAdminGuard();
  const { branchScope, branches, activeBranchId } = useAdminBranch();
  const { theme, themes } = useAdminTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isChecking = status === "checking";
  const profile = useProfileSummary(role);

  const currentBranchName = useMemo(() => {
    if (branchScope === "no_branch") return "Tickets sem filial";
    const branch = branches.find((item) => item.id === activeBranchId);
    return branch?.name ?? "Filial não selecionada";
  }, [activeBranchId, branchScope, branches]);

  const currentThemeName = useMemo(() => themes.find((item) => item.id === theme)?.name ?? "Tema", [theme, themes]);

  return (
    <div className={styles.appShell}>
      <aside className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ""}`} aria-label="Menu administrativo">
        <div className={styles.sidebarHeader}>
          <div className={styles.brandMark}>
            <span className={styles.brandIcon}>RB</span>
            <div className={styles.brandCopy}>
              <p className={styles.brandEyebrow}>RBagenda</p>
              <strong className={styles.brandTitle}>Admin</strong>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setIsMenuOpen(false)}
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>

        <BranchSelector />

        <div className={styles.navSection}>
          <p className={styles.sectionLabelMuted}>Navegação</p>
          <AdminNav disabled={isChecking} onNavigate={() => setIsMenuOpen(false)} />
        </div>

        <div className={styles.sidebarFooter}>
          <div className={styles.themeBadge} aria-live="polite">
            <span className={styles.themeDot} />
            <div>
              <p className={styles.themeLabel}>Tema ativo</p>
              <p className={styles.themeValue}>{currentThemeName}</p>
            </div>
          </div>
          <div className={styles.userCard}>
            <div className={styles.userAvatar} aria-hidden>
              {initialsFromName(profile?.name ?? null)}
            </div>
            <div className={styles.userMeta}>
              <p className={styles.userName}>{profile?.name ?? "Administrador"}</p>
              <p className={styles.userEmail}>{profile?.email ?? "E-mail não disponível"}</p>
              <p className={styles.userRole}>{role ?? "admin"}</p>
            </div>
          </div>
        </div>
      </aside>

      {isMenuOpen ? (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-label="Fechar menu lateral"
          onClick={() => setIsMenuOpen(false)}
        />
      ) : null}

      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              type="button"
              className={styles.hamburger}
              onClick={() => setIsMenuOpen(true)}
              aria-controls="admin-nav"
              aria-expanded={isMenuOpen}
            >
              ☰
              <span className="sr-only">Abrir menu</span>
            </button>
            <div>
              <p className={styles.topbarEyebrow}>Painel administrativo</p>
              <h1 className={styles.topbarTitle}>Central de operações</h1>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <div className={styles.topbarBadge}>
              <span className={styles.badgeDot} />
              <span className={styles.badgeLabel}>{currentBranchName}</span>
            </div>
            <div className={styles.topbarBadgeMuted}>
              <span className={styles.badgeLabel}>{role ?? "admin"}</span>
            </div>
          </div>
        </header>

        <div className={styles.contentFrame}>
          <div className={styles.contentInner}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminBranchProvider>
      <AdminShellContent>{children}</AdminShellContent>
    </AdminBranchProvider>
  );
}
