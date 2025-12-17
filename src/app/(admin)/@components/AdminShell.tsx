"use client";

import { useState, type ReactNode } from "react";

import AdminNav from "./AdminNav";
import { AdminBranchProvider, useAdminBranch } from "./AdminBranchContext";
import { useAdminGuard } from "../useAdminGuard";
import styles from "../admin.module.css";

function BranchSelector() {
  const { branches, activeBranchId, setActiveBranchId, branchScope, setBranchScope, loading, isMaster } =
    useAdminBranch();

  if (loading || branches.length === 0) {
    return null;
  }

  const selectValue =
    branchScope === "branch" ? activeBranchId ?? "" : branchScope === "no_branch" ? "__NO_BRANCH__" : "";

  return (
    <div className={styles.branchSelector}>
      <label className={styles.branchSelectorLabel} htmlFor="admin-active-branch">
        Filial ativa
      </label>
      <select
        id="admin-active-branch"
        className={styles.branchSelectorSelect}
        value={selectValue}
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
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const { status, role } = useAdminGuard();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isChecking = status === "checking";
  const roleLabel = role === "adminmaster" ? "Admin master" : role === "adminsuper" ? "Admin super" : "Admin";

  return (
    <AdminBranchProvider>
      <div className={styles.background}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.headerBar}>
              <button
                type="button"
                className={styles.menuButton}
                onClick={() => setIsMenuOpen(true)}
                aria-expanded={isMenuOpen}
                aria-controls="admin-nav"
              >
                <span className="sr-only">Abrir menu do painel</span>
                ☰
              </button>
              <div className={styles.headerCopy}>
                <p className={styles.headerSubtitle}>Acesso reservado</p>
                <h1 className={styles.headerTitle}>Painel administrativo · {roleLabel}</h1>
                <p className={styles.headerSubtitle}>
                  Controle total das operações, mantendo o mesmo visual leve e responsivo das páginas do cliente.
                </p>
              </div>
              <BranchSelector />
            </div>
          </header>

          <div className={styles.shellBody}>
            {isMenuOpen && (
              <button
                type="button"
                className={styles.navBackdrop}
                onClick={() => setIsMenuOpen(false)}
                aria-label="Fechar menu"
              />
            )}
            <div className={`${styles.navWrapper} ${isMenuOpen ? styles.navOpen : ""}`}>
              <div className={styles.panel} id="admin-nav">
                <AdminNav disabled={isChecking} role={role ?? undefined} />
              </div>
            </div>

            <div className={styles.contentPanel}>
              <div className={styles.contentPanelInner}>{children}</div>
            </div>
          </div>

          <p className={styles.footerNote}>
            Apenas administradores autenticados podem acessar estas páginas. O layout reutiliza o mesmo fundo lava-lamp do
            cliente.
          </p>
        </div>
      </div>
    </AdminBranchProvider>
  );
}
