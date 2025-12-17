"use client";

import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";

import styles from "../../../adminPanel.module.css";

function AuditContent() {
  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>Admin master</span>
          <h2 className={styles.heroTitle}>Auditoria</h2>
          <p className={styles.heroSubtitle}>Espaço reservado para histórico detalhado. Nenhuma query extra é disparada aqui.</p>
        </div>
      </section>

      <div className={styles.mutedPanel}>
        <p>Em breve: eventos críticos da plataforma e trilhas de auditoria.</p>
      </div>
    </div>
  );
}

export default function AuditPanel() {
  return (
    <PanelGuard
      allowedRoles={["adminmaster"]}
      fallbackRedirects={{
        admin: "/admin",
        adminsuper: "/admin/adminsuper",
        client: "/login",
        unauthenticated: "/login",
      }}
    >
      {() => <AuditContent />}
    </PanelGuard>
  );
}
