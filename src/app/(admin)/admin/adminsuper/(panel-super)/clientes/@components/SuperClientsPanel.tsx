"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";
import { useAdminBranch } from "@/app/(admin)/@components/AdminBranchContext";
import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";
import { useCurrentUserId } from "@/app/(admin)/@components/useCurrentUserId";

import styles from "../../../adminPanel.module.css";

type Client = {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp: string | null;
  branch_name: string | null;
  first_seen: string | null;
};

function SuperClientsContent() {
  const { branches, activeBranchId, branchScope, loading: branchLoading } = useAdminBranch();
  const { userId, loading: userLoading } = useCurrentUserId();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadClients = async () => {
      if (branchLoading || userLoading) return;
      if (!userId) {
        setError("Sessão inválida");
        setLoading(false);
        return;
      }

      const targetBranchIds = branchScope === "branch" && activeBranchId ? [activeBranchId] : branches.map((branch) => branch.id);

      if (targetBranchIds.length === 0) {
        setClients([]);
        setError("Nenhuma filial atribuída.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("appointments")
        .select(
          "starts_at, branch_id, branches(name), profiles:profiles!appointments_customer_id_fkey(id, full_name, email, whatsapp)"
        )
        .in("branch_id", targetBranchIds)
        .order("starts_at", { ascending: false })
        .limit(200);

      if (!active) return;

      if (queryError) {
        setError("Não foi possível carregar os clientes.");
        setClients([]);
        setLoading(false);
        return;
      }

      const map = new Map<string, Client>();

      (data ?? []).forEach((appointment) => {
        const profile = Array.isArray(appointment.profiles)
          ? appointment.profiles[0]
          : (appointment.profiles as Client | null | undefined);
        const branch = Array.isArray(appointment.branches)
          ? appointment.branches[0] ?? null
          : (appointment.branches as { name?: string | null } | null | undefined);

        if (profile?.id && !map.has(profile.id)) {
          map.set(profile.id, {
            id: profile.id,
            full_name: profile.full_name ?? null,
            email: profile.email ?? null,
            whatsapp: profile.whatsapp ?? null,
            branch_name: branch?.name ?? null,
            first_seen: appointment.starts_at ?? null,
          });
        }
      });

      setClients(Array.from(map.values()));
      setLoading(false);
    };

    void loadClients();

    return () => {
      active = false;
    };
  }, [activeBranchId, branchLoading, branchScope, branches, userId, userLoading]);

  const ordered = useMemo(
    () =>
      [...clients].sort((a, b) => {
        const aDate = a.first_seen ? new Date(a.first_seen).getTime() : 0;
        const bDate = b.first_seen ? new Date(b.first_seen).getTime() : 0;
        return bDate - aDate;
      }),
    [clients]
  );

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>Admin super</span>
          <h2 className={styles.heroTitle}>Clientes das suas filiais</h2>
          <p className={styles.heroSubtitle}>Lista deduplicada e carregada apenas das filiais que você lidera.</p>
        </div>
      </section>

      {error ? <div className={styles.mutedPanel}>{error}</div> : null}

      <div className={styles.panelCard}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Clientes</h3>
          <p className={styles.panelSubtitle}>{ordered.length} registros únicos</p>
        </div>

        {loading ? (
          <p>Carregando...</p>
        ) : ordered.length === 0 ? (
          <p>Nenhum cliente encontrado.</p>
        ) : (
          <ul className={styles.simpleList}>
            {ordered.map((client) => (
              <li key={client.id} className={styles.simpleListItem}>
                <div className={styles.simpleListContent}>
                  <p className={styles.simpleListTitle}>{client.full_name ?? "Cliente"}</p>
                  <p className={styles.simpleListSubtitle}>{client.email ?? "Sem e-mail"}</p>
                  <p className={styles.simpleListMeta}>{client.branch_name ?? "Sem filial"}</p>
                </div>
                {client.whatsapp ? <span className={styles.badge}>{client.whatsapp}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function SuperClientsPanel() {
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
      {() => <SuperClientsContent />}
    </PanelGuard>
  );
}
