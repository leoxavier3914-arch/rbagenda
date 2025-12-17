"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";
import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";
import { useCurrentUserId } from "@/app/(admin)/@components/useCurrentUserId";

import styles from "../../../adminPanel.module.css";

type Branch = {
  id: string;
  name: string;
};

type AppointmentStatus = "pending" | "reserved" | "confirmed" | "canceled" | "completed";

type Appointment = {
  id: string;
  branch_id: string | null;
  status: AppointmentStatus;
  starts_at: string;
};

function SuperDashboardContent() {
  const { userId, loading: userLoading } = useCurrentUserId();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (userLoading) return;

      if (!userId) {
        setError("Sessão inválida. Faça login novamente.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data: branchesData, error: branchesError } = await supabase
        .from("branches")
        .select("id, name")
        .eq("owner_id", userId)
        .order("name", { ascending: true });

      if (!active) return;

      if (branchesError) {
        setError("Não foi possível carregar suas filiais.");
        setLoading(false);
        return;
      }

      const branchIds = (branchesData ?? []).map((branch) => branch.id);
      setBranches((branchesData ?? []) as Branch[]);

      if (branchIds.length === 0) {
        setAppointments([]);
        setLoading(false);
        return;
      }

      const { data: apptData, error: apptError } = await supabase
        .from("appointments")
        .select("id, branch_id, status, starts_at")
        .in("branch_id", branchIds)
        .order("starts_at", { ascending: false })
        .limit(120);

      if (!active) return;

      if (apptError) {
        setError("Não foi possível carregar os agendamentos das suas filiais.");
        setAppointments([]);
        setLoading(false);
        return;
      }

      setAppointments((apptData ?? []) as Appointment[]);
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [userId, userLoading]);

  const stats = useMemo(() => {
    const byStatus = appointments.reduce<Record<AppointmentStatus, number>>(
      (acc, appt) => ({ ...acc, [appt.status]: (acc[appt.status] ?? 0) + 1 }),
      { pending: 0, reserved: 0, confirmed: 0, canceled: 0, completed: 0 }
    );

    return {
      total: appointments.length,
      active: byStatus.confirmed + byStatus.reserved,
      pending: byStatus.pending,
    };
  }, [appointments]);

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>Admin super</span>
          <h2 className={styles.heroTitle}>Visão geral das suas filiais</h2>
          <p className={styles.heroSubtitle}>
            Este painel carrega apenas informações das filiais que você lidera. Cada página permanece isolada.
          </p>
        </div>
        <div className={styles.heroMetrics}>
          <div className={styles.heroMetric}>
            <p className={styles.heroMetricLabel}>Filiais próprias</p>
            <p className={styles.heroMetricValue}>{branches.length}</p>
          </div>
          <div className={styles.heroMetric}>
            <p className={styles.heroMetricLabel}>Agendamentos ativos</p>
            <p className={styles.heroMetricValue}>{stats.active}</p>
          </div>
          <div className={styles.heroMetric}>
            <p className={styles.heroMetricLabel}>Pendentes</p>
            <p className={styles.heroMetricValue}>{stats.pending}</p>
          </div>
        </div>
      </section>

      {error ? <div className={styles.mutedPanel}>{error}</div> : null}

      {!error ? (
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Resumo rápido</h3>
            <p className={styles.panelSubtitle}>Total de agendamentos recentes: {stats.total}</p>
          </div>
          {loading ? <p>Carregando dados...</p> : <p>Use o menu para detalhar filiais, admins e clientes.</p>}
        </div>
      ) : null}
    </div>
  );
}

export default function SuperDashboardPanel() {
  return (
    <PanelGuard
      allowedRoles={["adminsuper"]}
      fallbackRedirects={{
        admin: "/admin",
        adminmaster: "/admin/adminmaster",
        client: "/login",
        unauthenticated: "/login",
      }}
    >
      {() => <SuperDashboardContent />}
    </PanelGuard>
  );
}
