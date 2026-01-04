"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";

import { useAdminGuard } from "../../../useAdminGuard";
import styles from "../clientes.module.css";

type AppointmentRow = {
  id: string;
  branch_id: string | null;
  service_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string | null;
  total_cents: number | null;
};

type ClientProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  whatsapp: string | null;
};

type Branch = {
  id: string;
  name: string;
};

type ClientPageProps = {
  params: {
    clientId: string;
  };
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatCurrencyFromCents(cents: number | null | undefined) {
  if (typeof cents !== "number") return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ClienteDetalhePage({ params }: ClientPageProps) {
  const { status } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authorized") return;
    let active = true;

    const loadCliente = async () => {
      setLoading(true);
      setError(null);

      const [
        { data: profileData, error: profileError },
        { data: appointmentsData, error: appointmentsError },
        { data: branchesData, error: branchesError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, created_at, whatsapp")
          .eq("id", params.clientId)
          .eq("role", "client")
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("id, branch_id, service_id, starts_at, ends_at, status, total_cents")
          .eq("customer_id", params.clientId)
          .order("starts_at", { ascending: false })
          .limit(20),
        supabase.from("branches").select("id, name").order("name"),
      ]);

      if (!active) return;

      if (profileError || appointmentsError || branchesError) {
        console.error("Erro ao carregar cliente", profileError, appointmentsError, branchesError);
        setError("Não foi possível carregar os dados do cliente agora.");
      }

      setProfile(profileData ?? null);
      setAppointments(appointmentsData ?? []);
      setBranches(branchesData ?? []);
      setLoading(false);
    };

    void loadCliente();

    return () => {
      active = false;
    };
  }, [params.clientId, status]);

  const branchesById = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach((branch) => {
      map[branch.id] = branch.name;
    });
    return map;
  }, [branches]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>CRM</p>
          <h1 className={styles.title}>Cliente</h1>
          <p className={styles.subtitle}>
            {profile ? `${profile.full_name || "Cliente"} · ${profile.email || "Sem e-mail"}` : "Detalhes e histórico recente."}
          </p>
        </div>
      </header>

      <div className={styles.detailLayout}>
        <div className={styles.infoCard}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionTitle}>Dados básicos</p>
              <p className={styles.sectionDescription}>Informações principais do cliente.</p>
            </div>
            <Link className={styles.ticketLink} href="/admin/tickets">
              🎫 Tickets do cliente
            </Link>
          </div>

          {loading ? <p className={styles.helperText}>Carregando dados...</p> : null}
          {error ? <p className={styles.helperText}>{error}</p> : null}

          {profile ? (
            <>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Nome</span>
                <span className={styles.infoValue}>{profile.full_name || "—"}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>E-mail</span>
                <span className={styles.infoValue}>{profile.email || "—"}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>WhatsApp</span>
                <span className={styles.infoValue}>{profile.whatsapp || "—"}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Desde</span>
                <span className={styles.infoValue}>{formatDateTime(profile.created_at)}</span>
              </div>
            </>
          ) : null}
          {!loading && !error && !profile ? <p className={styles.helperText}>Cliente não encontrado ou sem permissão.</p> : null}
        </div>

        <section className={styles.listCard}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionTitle}>Agendamentos recentes</p>
              <p className={styles.sectionDescription}>Últimas 20 entradas visíveis para você.</p>
            </div>
          </div>

          {error ? <p className={styles.helperText}>{error}</p> : null}
          {loading ? <p className={styles.helperText}>Carregando agendamentos...</p> : null}

          {!loading && !error ? (
            appointments.length === 0 ? (
              <div className={styles.emptyState}>Sem dados para este cliente.</div>
            ) : (
              <ul className={styles.appointmentList}>
                {appointments.map((appointment) => (
                  <li key={appointment.id} className={styles.appointmentItem}>
                    <div className={styles.appointmentMeta}>
                      <p className={styles.appointmentTitle}>{formatDateTime(appointment.starts_at)}</p>
                      <p className={styles.appointmentSub}>
                        {appointment.branch_id ? branchesById[appointment.branch_id] || "Filial não disponível" : "Filial não disponível"}
                      </p>
                      <p className={styles.appointmentSub}>
                        Serviço: {appointment.service_id || "—"} · Valor: {formatCurrencyFromCents(appointment.total_cents)}
                      </p>
                    </div>
                    <span className={`${styles.statusBadge} ${appointment.status === "confirmed" ? styles.badgeAccent : ""}`}>
                      {appointment.status ? appointment.status.toUpperCase() : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </section>
      </div>
    </div>
  );
}
