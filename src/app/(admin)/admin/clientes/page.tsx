"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";

import { useAdminGuard } from "../../useAdminGuard";
import styles from "./clientes.module.css";

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

type BranchFilter = "all" | string;

type ClientStats = {
  lastAppointmentAt: string | null;
  appointmentsCount: number;
  totalSpentCents: number;
  branchesSeen: Set<string>;
};

type ClientWithStats = {
  profile: ClientProfile;
  stats: ClientStats | undefined;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function buildInitials(name?: string | null, email?: string | null) {
  const source = (name || email || "CL").trim();
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function ClientesPage() {
  const { status } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientStats, setClientStats] = useState<Record<string, ClientStats>>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<BranchFilter>("all");
  const [search, setSearch] = useState("");
  const [onlyWithAppointments, setOnlyWithAppointments] = useState(true);

  useEffect(() => {
    if (status !== "authorized") return;
    let active = true;

    const loadClientes = async () => {
      setLoading(true);
      setError(null);

      const [{ data: appointmentsData, error: appointmentsError }, { data: branchesData, error: branchesError }] = await Promise.all([
        supabase
          .from("appointments")
          .select("customer_id, branch_id, starts_at, status, total_cents")
          .order("starts_at", { ascending: false })
          .limit(1000),
        supabase.from("branches").select("id, name").order("name"),
      ]);

      if (!active) return;

      if (appointmentsError || branchesError) {
        console.error("Erro ao carregar clientes", appointmentsError, branchesError);
        setError("Não foi possível carregar os clientes agora.");
      }

      const statsMap: Record<string, ClientStats> = {};
      const validAppointments = (appointmentsData ?? []).filter((appointment) => appointment.customer_id);

      validAppointments.forEach((appointment) => {
        const customerId = appointment.customer_id as string;
        if (!statsMap[customerId]) {
          statsMap[customerId] = {
            lastAppointmentAt: appointment.starts_at,
            appointmentsCount: 0,
            totalSpentCents: 0,
            branchesSeen: new Set<string>(),
          };
        }

        const stats = statsMap[customerId];
        stats.appointmentsCount += 1;
        stats.totalSpentCents += appointment.total_cents ?? 0;
        if (appointment.starts_at && (!stats.lastAppointmentAt || new Date(appointment.starts_at) > new Date(stats.lastAppointmentAt))) {
          stats.lastAppointmentAt = appointment.starts_at;
        }
        if (appointment.branch_id) stats.branchesSeen.add(appointment.branch_id);
      });

      const customerIds = Object.keys(statsMap);

      let profilesData: ClientProfile[] = [];

      if (customerIds.length > 0) {
        const { data: profilesResponse, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email, created_at, whatsapp")
          .in("id", customerIds)
          .eq("role", "client");

        if (!active) return;

        if (profilesError) {
          console.error("Erro ao carregar perfis de clientes", profilesError);
          setError("Não foi possível carregar os clientes agora.");
        } else {
          profilesData = profilesResponse ?? [];
        }
      }

      setBranches(branchesData ?? []);
      setClientStats(statsMap);
      setClients(profilesData);
      setLoading(false);
    };

    void loadClientes();

    return () => {
      active = false;
    };
  }, [status]);

  const branchesById = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach((branch) => {
      map[branch.id] = branch.name;
    });
    return map;
  }, [branches]);

  const clientsWithStats = useMemo<ClientWithStats[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return clients
      .map<ClientWithStats>((profile) => ({ profile, stats: clientStats[profile.id] }))
      .filter(({ profile, stats }) => {
        if (onlyWithAppointments && (!stats || stats.appointmentsCount <= 0)) return false;
        if (branchFilter !== "all" && stats && !stats.branchesSeen.has(branchFilter)) return false;

        if (!normalizedSearch) return true;
        const name = (profile.full_name || "").toLowerCase();
        const email = (profile.email || "").toLowerCase();
        return name.includes(normalizedSearch) || email.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const aDate = a.stats?.lastAppointmentAt ? new Date(a.stats.lastAppointmentAt).getTime() : 0;
        const bDate = b.stats?.lastAppointmentAt ? new Date(b.stats.lastAppointmentAt).getTime() : 0;
        return bDate - aDate;
      });
  }, [branchFilter, clientStats, clients, onlyWithAppointments, search]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>CRM</p>
          <h1 className={styles.title}>Clientes</h1>
          <p className={styles.subtitle}>Veja os clientes que já tiveram contato com suas filiais e acesse os detalhes rapidamente.</p>
        </div>
      </header>

      <section className={styles.listCard}>
        <div className={styles.listHeader}>
          <div>
            <p className={styles.eyebrow}>Base de clientes</p>
            <h2 className={styles.cardTitle}>Clientes com agendamentos no escopo</h2>
            <p className={styles.cardDescription}>
              A lista considera apenas clientes com agendamentos visíveis para você. Filtre por filial ou busque por nome e e-mail.
            </p>
          </div>

          <div className={styles.filterRow}>
            <label className={styles.filterControl}>
              <span className={styles.filterLabel}>Filial</span>
              <select
                className={styles.selectControl}
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value as BranchFilter)}
                disabled={loading}
              >
                <option value="all">Todas as filiais</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.filterControl}>
              <span className={styles.filterLabel}>Busca</span>
              <input
                className={styles.inputControl}
                placeholder="Nome ou e-mail"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                disabled={loading}
              />
            </label>

            <label className={styles.filterControlCheckbox}>
              <input
                type="checkbox"
                checked={onlyWithAppointments}
                onChange={(event) => setOnlyWithAppointments(event.target.checked)}
                disabled={loading}
              />
              <span>Somente com agendamentos</span>
            </label>
          </div>
        </div>

        {error ? <div className={styles.helperText}>{error}</div> : null}
        {loading ? <div className={styles.helperText}>Carregando clientes...</div> : null}

        {!loading && !error ? (
          clientsWithStats.length === 0 ? (
            <div className={styles.emptyState}>Nenhum cliente encontrado com os filtros atuais.</div>
          ) : (
            <div className={styles.clientGrid}>
              {clientsWithStats.map(({ profile, stats }) => {
                const initials = buildInitials(profile.full_name, profile.email);
                const branchNames = stats ? Array.from(stats.branchesSeen).map((branchId) => branchesById[branchId] || "—") : [];

                return (
                  <article key={profile.id} className={styles.clientCard}>
                    <div className={styles.clientHeader}>
                      <div className={styles.clientIdentity}>
                        <span className={styles.clientAvatar} aria-hidden>
                          {initials}
                        </span>
                        <div className={styles.clientText}>
                          <p className={styles.clientName}>{profile.full_name || "Cliente"}</p>
                          <p className={styles.clientEmail}>{profile.email || "Sem e-mail"}</p>
                        </div>
                      </div>

                      <div className={styles.clientStats}>
                        <div className={styles.statBlock}>
                          <span className={styles.statLabel}>Último agendamento</span>
                          <span className={styles.statValue}>{stats?.lastAppointmentAt ? formatDateTime(stats.lastAppointmentAt) : "—"}</span>
                        </div>
                        <div className={styles.statBlock}>
                          <span className={styles.statLabel}>Qtd agendamentos</span>
                          <span className={styles.statValue}>{stats?.appointmentsCount ?? 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.clientFooter}>
                      <div className={styles.branchGroup}>
                        <span className={styles.metaLabel}>Filiais no escopo</span>
                        <div className={styles.branchBadges}>
                          {branchNames.length > 0 ? (
                            branchNames.map((name, index) => (
                              <span key={`${profile.id}-branch-${index}`} className={styles.branchBadge}>
                                {name}
                              </span>
                            ))
                          ) : (
                            <span className={styles.branchBadgeMuted}>—</span>
                          )}
                        </div>
                      </div>
                      <Link className={styles.openLink} href={`/admin/clientes/${profile.id}`}>
                        Abrir
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}
