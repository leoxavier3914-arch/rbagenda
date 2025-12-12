"use client";

import type { ReactNode } from "react";

import AdminNav from "./AdminNav";
import { useAdminGuard } from "../useAdminGuard";
import styles from "../admin.module.css";

export default function AdminShell({ children }: { children: ReactNode }) {
  const { status } = useAdminGuard();

  const isChecking = status === "checking";

  return (
    <div className={styles.background}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.headerSubtitle}>Acesso reservado</p>
          <h1 className={styles.headerTitle}>Painel administrativo</h1>
          <p className={styles.headerSubtitle}>
            Controle total das operações, mantendo o mesmo visual leve e responsivo das páginas do cliente.
          </p>
        </header>

        <div className={styles.shellBody}>
          <div className={styles.navWrapper}>
            <div className={styles.panel}>
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
