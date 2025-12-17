"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";
import { useAdminBranch } from "@/app/(admin)/@components/AdminBranchContext";
import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";

import styles from "../../../adminPanel.module.css";

type Client = {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp: string | null;
  first_seen: string | null;
};

function ClientsContent() {
  const { activeBranchId, branchScope, loading: branchLoading } = useAdminBranch();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadClients = async () => {
      if (branchLoading) return;

      if (branchScope !== "branch" || !activeBranchId) {
        setClients([]);
        setError("Selecione uma filial para enxergar os clientes atendidos.");
        setLoading(false);
        return;
      }

      setError(null);
      setLoading(true);

      const { data, error: queryError } = await supabase
        .from("appointments")
        .select("starts_at, profiles:profiles!appointments_customer_id_fkey(id, full_name, email, whatsapp)")
        .eq("branch_id", activeBranchId)
        .order("starts_at", { ascending: false })
        .limit(120);

      if (!active) return;

      if (queryError) {
        setError("Não foi possível carregar os clientes desta filial.");
        setClients([]);
        setLoading(false);
        return;
      }

      const map = new Map<string, Client>();

      (data ?? []).forEach((appointment) => {
        const profile = Array.isArray(appointment.profiles)
          ? appointment.profiles[0]
          : (appointment.profiles as Client | null | undefined);

        if (profile?.id && !map.has(profile.id)) {
          map.set(profile.id, {
            id: profile.id,
            full_name: profile.full_name ?? null,
            email: profile.email ?? null,
            whatsapp: profile.whatsapp ?? null,
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
  }, [activeBranchId, branchLoading, branchScope]);

  const orderedClients = useMemo(
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
          <span className={styles.badge}>Admin</span>
          <h2 className={styles.heroTitle}>Clientes por filial</h2>
          <p className={styles.heroSubtitle}>Somente os clientes atendidos na filial selecionada são listados aqui.</p>
        </div>
      </section>

      {branchScope !== "branch" || !activeBranchId ? (
        <div className={styles.mutedPanel}>
          <p>{error ?? "Selecione uma filial para ver os clientes."}</p>
        </div>
      ) : null}

      {branchScope === "branch" && activeBranchId ? (
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Clientes atendidos</h3>
            <p className={styles.panelSubtitle}>{orderedClients.length} registros únicos</p>
          </div>

          {loading ? (
            <p>Carregando clientes...</p>
          ) : error ? (
            <p>{error}</p>
          ) : orderedClients.length === 0 ? (
            <p>Nenhum cliente encontrado para esta filial.</p>
          ) : (
            <ul className={styles.simpleList}>
              {orderedClients.map((client) => (
                <li key={client.id} className={styles.simpleListItem}>
                  <div className={styles.simpleListContent}>
                    <p className={styles.simpleListTitle}>{client.full_name ?? "Cliente"}</p>
                    <p className={styles.simpleListSubtitle}>{client.email ?? "Sem e-mail"}</p>
                    <p className={styles.simpleListMeta}>
                      Primeiro atendimento: {client.first_seen ? new Date(client.first_seen).toLocaleString("pt-BR") : "-"}
                    </p>
                  </div>
                  {client.whatsapp ? <span className={styles.badge}>{client.whatsapp}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function ClientsPanel() {
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
      {() => <ClientsContent />}
    </PanelGuard>
  );
}
