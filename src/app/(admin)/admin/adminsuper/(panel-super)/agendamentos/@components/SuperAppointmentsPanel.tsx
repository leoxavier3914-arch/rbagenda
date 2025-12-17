"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";
import { useAdminBranch } from "@/app/(admin)/@components/AdminBranchContext";
import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";
import { useCurrentUserId } from "@/app/(admin)/@components/useCurrentUserId";

import styles from "../../../adminPanel.module.css";

type AppointmentStatus = "pending" | "reserved" | "confirmed" | "canceled" | "completed";

type Appointment = {
  id: string;
  branch_id: string | null;
  branch_name: string | null;
  status: AppointmentStatus;
  starts_at: string;
  customer_name: string | null;
};

function SuperAppointmentsContent() {
  const { branches, activeBranchId, branchScope, loading: branchLoading } = useAdminBranch();
  const { userId, loading: userLoading } = useCurrentUserId();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (branchLoading || userLoading) return;
      if (!userId) {
        setError("Sessão inválida");
        setLoading(false);
        return;
      }

      const targetBranchIds = branchScope === "branch" && activeBranchId ? [activeBranchId] : branches.map((branch) => branch.id);

      if (targetBranchIds.length === 0) {
        setError("Nenhuma filial atribuída.");
        setAppointments([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("appointments")
        .select(
          "id, branch_id, status, starts_at, profiles:profiles!appointments_customer_id_fkey(full_name), branches(name)"
        )
        .in("branch_id", targetBranchIds)
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
        const profile = Array.isArray(appointment.profiles)
          ? appointment.profiles[0] ?? null
          : appointment.profiles ?? null;
        const branch = Array.isArray(appointment.branches)
          ? appointment.branches[0] ?? null
          : appointment.branches ?? null;

        return {
          id: appointment.id,
          branch_id: appointment.branch_id ?? null,
          branch_name: branch?.name ?? null,
          status: (appointment.status ?? "pending") as AppointmentStatus,
          starts_at: appointment.starts_at,
          customer_name: profile?.full_name ?? null,
        } satisfies Appointment;
      });

      setAppointments(normalized);
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [activeBranchId, branchLoading, branchScope, branches, userId, userLoading]);

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
          <span className={styles.badge}>Admin super</span>
          <h2 className={styles.heroTitle}>Agendamentos das suas filiais</h2>
          <p className={styles.heroSubtitle}>Filtre pela filial ativa ou veja todas de uma vez.</p>
        </div>
      </section>

      {error ? <div className={styles.mutedPanel}>{error}</div> : null}

      <div className={styles.gridTwoColumns}>
        {grouped.map((group) => (
          <div key={group.key} className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>{group.label}</h3>
              <p className={styles.panelSubtitle}>{group.items.length} agendamentos</p>
            </div>

            {loading ? (
              <p>Carregando...</p>
            ) : group.items.length === 0 ? (
              <p className={styles.panelSubtitle}>Nada aqui ainda.</p>
            ) : (
              <ul className={styles.simpleList}>
                {group.items.map((item) => (
                  <li key={item.id} className={styles.simpleListItem}>
                    <div className={styles.simpleListContent}>
                      <p className={styles.simpleListTitle}>{item.branch_name ?? "Filial"}</p>
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
                    <span className={styles.badge}>{item.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuperAppointmentsPanel() {
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
      {() => <SuperAppointmentsContent />}
    </PanelGuard>
  );
}
