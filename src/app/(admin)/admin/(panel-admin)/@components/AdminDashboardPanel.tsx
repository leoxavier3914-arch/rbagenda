"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";
import { useAdminBranch } from "@/app/(admin)/@components/AdminBranchContext";
import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";

import styles from "../../adminPanel.module.css";

type AppointmentStatus = "pending" | "reserved" | "confirmed" | "canceled" | "completed";

type Appointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  customer_name: string | null;
  service_name: string | null;
};

function AdminDashboardContent() {
  const { activeBranchId, branchScope, loading: branchLoading } = useAdminBranch();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (branchLoading) return;

      if (branchScope !== "branch" || !activeBranchId) {
        setAppointments([]);
        setBranchName(null);
        setError("Selecione uma filial para visualizar o painel.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [branchResponse, appointmentsResponse] = await Promise.all([
        supabase.from("branches").select("id, name").eq("id", activeBranchId).maybeSingle(),
        supabase
          .from("appointments")
          .select(
            "id, starts_at, ends_at, status, services:services(name), profiles:profiles!appointments_customer_id_fkey(full_name)"
          )
          .eq("branch_id", activeBranchId)
          .order("starts_at", { ascending: false })
          .limit(24),
      ]);

      if (!active) return;

      if (branchResponse.error) {
        setError("Não foi possível carregar a filial selecionada.");
        setLoading(false);
        return;
      }

      if (appointmentsResponse.error) {
        setError("Não foi possível carregar os agendamentos da filial.");
        setLoading(false);
        return;
      }

      const resolvedBranchName = branchResponse.data?.name ?? null;
      const normalizedAppointments = (appointmentsResponse.data ?? []).map((appointment) => {
        const service = Array.isArray(appointment.services)
          ? appointment.services[0] ?? null
          : appointment.services ?? null;
        const profile = Array.isArray(appointment.profiles)
          ? appointment.profiles[0] ?? null
          : appointment.profiles ?? null;

        return {
          id: appointment.id,
          starts_at: appointment.starts_at,
          ends_at: appointment.ends_at,
          status: (appointment.status ?? "pending") as AppointmentStatus,
          customer_name: profile?.full_name ?? null,
          service_name: service?.name ?? null,
        } satisfies Appointment;
      });

      setBranchName(resolvedBranchName);
      setAppointments(normalizedAppointments);
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [activeBranchId, branchLoading, branchScope]);

  const stats = useMemo(() => {
    const upcoming = appointments.filter((appt) => ["confirmed", "reserved"].includes(appt.status)).length;
    const pending = appointments.filter((appt) => appt.status === "pending").length;
    const completed = appointments.filter((appt) => appt.status === "completed").length;
    return { upcoming, pending, completed };
  }, [appointments]);

  const recentAppointments = useMemo(() => appointments.slice(0, 6), [appointments]);

  const statusLabel: Record<AppointmentStatus, string> = {
    pending: "Pendente",
    reserved: "Reservado",
    confirmed: "Confirmado",
    canceled: "Cancelado",
    completed: "Finalizado",
  };

  const statusBadge: Record<AppointmentStatus, string> = {
    pending: styles.badge,
    reserved: styles.badge,
    confirmed: styles.badge,
    canceled: styles.badge,
    completed: styles.badge,
  };

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>Admin</span>
          <h2 className={styles.heroTitle}>Resumo rápido da filial ativa</h2>
          <p className={styles.heroSubtitle}>
            Veja como estão os agendamentos e clientes apenas da filial selecionada. Cada painel lê somente os dados que
            você precisa gerenciar.
          </p>
        </div>
        <div className={styles.heroMeta}>
          <p className={styles.metaTitle}>Filial em foco</p>
          <p className={styles.metaValue}>{branchName ?? "Selecione uma filial"}</p>
        </div>
      </section>

      {branchScope !== "branch" || !activeBranchId ? (
        <div className={styles.mutedPanel}>
          <p className={styles.metaTitle}>{error ?? "Escolha uma filial para carregar as métricas"}</p>
        </div>
      ) : null}

      {branchScope === "branch" && activeBranchId ? (
        <div className={styles.gridTwoColumns}>
          <div className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Indicadores</h3>
              <p className={styles.panelSubtitle}>Somente desta filial</p>
            </div>
            <div className={styles.statGrid}>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>Agendamentos ativos</p>
                <p className={styles.statValue}>{stats.upcoming}</p>
              </div>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>Pendentes</p>
                <p className={styles.statValue}>{stats.pending}</p>
              </div>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>Finalizados</p>
                <p className={styles.statValue}>{stats.completed}</p>
              </div>
            </div>
          </div>

          <div className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Próximos compromissos</h3>
              <p className={styles.panelSubtitle}>Atualiza em tempo real conforme o Supabase</p>
            </div>
            {loading ? (
              <p className={styles.metaTitle}>Carregando agendamentos...</p>
            ) : error ? (
              <p className={styles.metaTitle}>{error}</p>
            ) : recentAppointments.length === 0 ? (
              <p className={styles.metaTitle}>Nenhum agendamento encontrado para esta filial.</p>
            ) : (
              <ul className={styles.simpleList}>
                {recentAppointments.map((appointment) => (
                  <li key={appointment.id} className={styles.simpleListItem}>
                    <div className={styles.simpleListContent}>
                      <p className={styles.simpleListTitle}>{appointment.service_name ?? "Serviço"}</p>
                      <p className={styles.simpleListSubtitle}>{appointment.customer_name ?? "Cliente"}</p>
                      <p className={styles.simpleListMeta}>
                        {new Date(appointment.starts_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className={statusBadge[appointment.status]}>{statusLabel[appointment.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminDashboardPanel() {
  return (
    <PanelGuard
      allowedRoles={["admin"]}
      fallbackRedirects={{
        adminsuper: "/admin/adminsuper",
        adminmaster: "/admin/adminmaster",
        client: "/login",
        unauthenticated: "/login",
      }}
    >
      {() => <AdminDashboardContent />}
    </PanelGuard>
  );
}
