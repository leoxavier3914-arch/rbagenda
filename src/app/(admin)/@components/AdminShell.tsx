"use client";

import { useState, type ReactNode } from "react";

import AdminNav from "./AdminNav";
import { useAdminGuard } from "../useAdminGuard";
import styles from "../admin.module.css";

export default function AdminShell({ children }: { children: ReactNode }) {
  const { status } = useAdminGuard();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isChecking = status === "checking";

  return (
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
              <h1 className={styles.headerTitle}>Painel administrativo</h1>
              <p className={styles.headerSubtitle}>
                Controle total das operações, mantendo o mesmo visual leve e responsivo das páginas do cliente.
              </p>
            </div>
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
              <AdminNav disabled={isChecking} />
            </div>
          </div>

          <div className={styles.contentPanel}>
            <div className={styles.contentPanelInner}>{children}</div>
          </div>
        </div>

        <p className={styles.footerNote}>
          Apenas administradores autenticados podem acessar estas páginas. O layout reutiliza o mesmo fundo lava-lamp do cliente.
        </p>
      </div>
    </div>
  );
}
