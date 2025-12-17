"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";
import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";

import styles from "../../../adminPanel.module.css";

type CountSnapshot = {
  branches: number;
  supers: number;
  appointments: number;
};

function MasterDashboardContent() {
  const [snapshot, setSnapshot] = useState<CountSnapshot>({ branches: 0, supers: 0, appointments: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [branchesResponse, supersResponse, appointmentsResponse] = await Promise.all([
        supabase.from("branches").select("id"),
        supabase.from("profiles").select("id").eq("role", "adminsuper"),
        supabase.from("appointments").select("id").limit(200),
      ]);

      if (!active) return;

      if (branchesResponse.error || supersResponse.error || appointmentsResponse.error) {
        setError("Não foi possível carregar o resumo global agora.");
        setLoading(false);
        return;
      }

      setSnapshot({
        branches: branchesResponse.data?.length ?? 0,
        supers: supersResponse.data?.length ?? 0,
        appointments: appointmentsResponse.data?.length ?? 0,
      });
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const heroCopy = useMemo(
    () => ({
      branches: `${snapshot.branches} filiais`,
      supers: `${snapshot.supers} supers`,
      appointments: `${snapshot.appointments} agendamentos recentes`,
    }),
    [snapshot]
  );

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>Admin master</span>
          <h2 className={styles.heroTitle}>Comando global</h2>
          <p className={styles.heroSubtitle}>
            Cada página do painel master é isolada e carrega apenas o que precisa. Nenhum hub monolítico.
          </p>
        </div>
        <div className={styles.heroMetrics}>
          <div className={styles.heroMetric}>
            <p className={styles.heroMetricLabel}>Filiais</p>
            <p className={styles.heroMetricValue}>{heroCopy.branches}</p>
          </div>
          <div className={styles.heroMetric}>
            <p className={styles.heroMetricLabel}>Supers</p>
            <p className={styles.heroMetricValue}>{heroCopy.supers}</p>
          </div>
          <div className={styles.heroMetric}>
            <p className={styles.heroMetricLabel}>Agendamentos</p>
            <p className={styles.heroMetricValue}>{heroCopy.appointments}</p>
          </div>
        </div>
      </section>

      {error ? <div className={styles.mutedPanel}>{error}</div> : null}

      {!error ? (
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Navegação</h3>
            <p className={styles.panelSubtitle}>Use os links laterais para filiais, supers e auditoria.</p>
          </div>
          {loading ? <p>Carregando...</p> : <p>Resumo pronto. Nenhuma chamada extra é feita fora deste módulo.</p>}
        </div>
      ) : null}
    </div>
  );
}

export default function MasterDashboardPanel() {
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
      {() => <MasterDashboardContent />}
    </PanelGuard>
  );
}
