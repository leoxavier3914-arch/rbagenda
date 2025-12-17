"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";
import { useAdminBranch } from "@/app/(admin)/@components/AdminBranchContext";
import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";

import styles from "../../../adminPanel.module.css";

type AppointmentStatus = "pending" | "reserved" | "confirmed" | "canceled" | "completed";

type Appointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  customer_name: string | null;
  service_name: string | null;
};

const statusLabel: Record<AppointmentStatus, string> = {
  pending: "Pendente",
  reserved: "Reservado",
  confirmed: "Confirmado",
  canceled: "Cancelado",
  completed: "Finalizado",
};

function AppointmentsContent() {
  const { activeBranchId, branchScope, loading: branchLoading } = useAdminBranch();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadAppointments = async () => {
      if (branchLoading) return;

      if (branchScope !== "branch" || !activeBranchId) {
        setAppointments([]);
        setError("Selecione uma filial para visualizar os agendamentos.");
        setLoading(false);
        return;
      }

      setError(null);
      setLoading(true);

      const { data, error: queryError } = await supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, status, services:services(name), profiles:profiles!appointments_customer_id_fkey(full_name)"
        )
        .eq("branch_id", activeBranchId)
        .order("starts_at", { ascending: false })
        .limit(100);

      if (!active) return;

      if (queryError) {
        setError("Não foi possível carregar os agendamentos.");
        setAppointments([]);
        setLoading(false);
        return;
      }

      const normalized = (data ?? []).map((appointment) => {
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

      setAppointments(normalized);
      setLoading(false);
    };

    void loadAppointments();

    return () => {
      active = false;
    };
  }, [activeBranchId, branchLoading, branchScope]);

  const grouped = useMemo(() => {
    return [
      { key: "ativos", label: "Ativos", statuses: ["confirmed", "reserved"] },
      { key: "pendentes", label: "Pendentes", statuses: ["pending"] },
      { key: "finalizados", label: "Finalizados", statuses: ["completed"] },
      { key: "cancelados", label: "Cancelados", statuses: ["canceled"] },
    ].map((group) => ({
      ...group,
      items: appointments.filter((appt) => group.statuses.includes(appt.status)),
    }));
  }, [appointments]);

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>Admin</span>
          <h2 className={styles.heroTitle}>Agendamentos da filial</h2>
          <p className={styles.heroSubtitle}>Somente as reservas das filiais atribuídas aparecem aqui.</p>
        </div>
      </section>

      {branchScope !== "branch" || !activeBranchId ? (
        <div className={styles.mutedPanel}>
          <p>{error ?? "Selecione uma filial para listar agendamentos."}</p>
        </div>
      ) : null}

      {branchScope === "branch" && activeBranchId ? (
        <div className={styles.gridTwoColumns}>
          {grouped.map((group) => (
            <div key={group.key} className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>{group.label}</h3>
                <p className={styles.panelSubtitle}>{group.items.length} registros</p>
              </div>

              {loading ? (
                <p>Carregando...</p>
              ) : group.items.length === 0 ? (
                <p className={styles.panelSubtitle}>Nenhum item neste grupo.</p>
              ) : (
                <ul className={styles.simpleList}>
                  {group.items.map((item) => (
                    <li key={item.id} className={styles.simpleListItem}>
                      <div className={styles.simpleListContent}>
                        <p className={styles.simpleListTitle}>{item.service_name ?? "Serviço"}</p>
                        <p className={styles.simpleListSubtitle}>{item.customer_name ?? "Cliente"}</p>
                        <p className={styles.simpleListMeta}>
                          {new Date(item.starts_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span className={styles.badge}>{statusLabel[item.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AppointmentsPanel() {
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
      {() => <AppointmentsContent />}
    </PanelGuard>
  );
}
