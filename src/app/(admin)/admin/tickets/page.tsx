"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";

import { useAdminGuard } from "../../useAdminGuard";
import styles from "./tickets.module.css";

type ThreadProfile = {
  full_name: string | null;
  name?: string | null;
  email: string | null;
} | null;

type SupportThreadRow = {
  id: string;
  branch_id: string | null;
  status: "open" | "closed" | "escalated" | string | null;
  updated_at: string;
  last_message_preview: string | null;
  last_actor: "user" | "staff" | "assistant" | null;
  profiles: ThreadProfile | ThreadProfile[] | null;
};

type StatusFilter = "all" | "open" | "escalated" | "closed";
type BranchFilter = "all" | string;

type Branch = {
  id: string;
  name: string;
};

const STATUS_LABEL: Record<Exclude<StatusFilter, "all">, string> = {
  open: "Aberto",
  escalated: "Escalado",
  closed: "Fechado",
};

function extractProfile(profiles: SupportThreadRow["profiles"]): ThreadProfile {
  if (Array.isArray(profiles)) return profiles[0] ?? null;
  return profiles;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function TicketsPage() {
  const { status } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [threads, setThreads] = useState<SupportThreadRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [branchFilter, setBranchFilter] = useState<BranchFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status !== "authorized") return;
    let active = true;

    const loadThreads = async () => {
      setLoading(true);
      setError(null);

      const [{ data: threadsData, error: threadsError }, { data: branchesData, error: branchesError }] = await Promise.all([
        supabase
          .from("support_threads")
          .select("id, branch_id, status, updated_at, last_message_preview, last_actor, profiles(full_name, email)")
          .order("updated_at", { ascending: false }),
        supabase.from("branches").select("id, name").order("name"),
      ]);

      if (!active) return;

      if (threadsError || branchesError) {
        console.error("Erro ao carregar tickets ou filiais", threadsError, branchesError);
        setError("Não foi possível carregar os tickets agora.");
      }

      setThreads(threadsData ?? []);
      setBranches(branchesData ?? []);

      setLoading(false);
    };

    void loadThreads();

    return () => {
      active = false;
    };
  }, [status]);

  const branchesById = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(({ id, name }) => {
      map[id] = name;
    });
    return map;
  }, [branches]);

  const filteredThreads = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return threads.filter((thread) => {
      const normalizedStatus = (thread.status ?? "").toString().toLowerCase();
      if (statusFilter !== "all" && normalizedStatus !== statusFilter) return false;
      if (branchFilter !== "all" && thread.branch_id !== branchFilter) return false;

      if (!normalizedSearch) return true;

      const profile = extractProfile(thread.profiles);
      const name = (profile?.full_name || profile?.name || "").toLowerCase();
      const email = (profile?.email || "").toLowerCase();
      const preview = (thread.last_message_preview || "").toLowerCase();

      return (
        name.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        preview.includes(normalizedSearch) ||
        thread.id.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [branchFilter, search, statusFilter, threads]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Suporte</p>
          <h1 className={styles.title}>Tickets</h1>
          <p className={styles.subtitle}>Centralize a fila de atendimento e abra as conversas em uma nova tela.</p>
        </div>
      </header>

      <section className={styles.listCard}>
        <div className={styles.listHeader}>
          <div>
            <p className={styles.eyebrow}>Fila de tickets</p>
            <h2 className={styles.cardTitle}>Tickets de suporte</h2>
            <p className={styles.cardDescription}>Filtre por status e encontre rapidamente clientes por nome, e-mail ou prévia.</p>
          </div>
          <div className={styles.filterRow}>
            <label className={styles.filterControl}>
              <span className={styles.filterLabel}>Status</span>
              <select
                className={styles.selectControl}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                disabled={loading}
              >
                <option value="all">Todos</option>
                <option value="open">Abertos</option>
                <option value="escalated">Escalados</option>
                <option value="closed">Fechados</option>
              </select>
            </label>

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
                placeholder="Nome, e-mail ou prévia"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                disabled={loading}
              />
            </label>
          </div>
        </div>

        {error ? <div className={styles.helperText}>{error}</div> : null}
        {loading ? <div className={styles.helperText}>Carregando tickets...</div> : null}

        {!loading && !error ? (
          filteredThreads.length === 0 ? (
            <div className={styles.emptyState}>Nenhum ticket encontrado com os filtros atuais.</div>
          ) : (
            <div className={styles.ticketGrid}>
              {filteredThreads.map((thread) => {
                const profile = extractProfile(thread.profiles);
                const normalizedStatus = (thread.status ?? "").toString().toLowerCase();
                const statusLabel = STATUS_LABEL[normalizedStatus as Exclude<StatusFilter, "all">] ?? "Aberto";
                const statusClass =
                  normalizedStatus === "closed"
                    ? styles.statusClosed
                    : normalizedStatus === "escalated"
                    ? styles.statusEscalated
                    : styles.statusOpen;
                const initials =
                  (profile?.full_name || profile?.name || profile?.email || "CL")
                    .trim()
                    .slice(0, 2)
                    .toUpperCase() || "CL";
                const branchName = thread.branch_id ? branchesById[thread.branch_id] ?? "—" : "Global";

                return (
                  <article key={thread.id} className={styles.ticketCard}>
                    <div className={styles.ticketHeader}>
                      <div className={styles.clientInfo}>
                        <span className={styles.clientAvatar} aria-hidden>
                          {initials}
                        </span>
                        <div className={styles.clientText}>
                          <p className={styles.clientName}>{profile?.full_name || profile?.name || "Cliente"}</p>
                          <p className={styles.clientEmail}>{profile?.email || "Sem e-mail"}</p>
                        </div>
                      </div>
                      <div className={styles.meta}>
                        <span className={`${styles.statusBadge} ${statusClass}`}>{statusLabel}</span>
                        <span className={styles.timestamp}>{formatDate(thread.updated_at)}</span>
                      </div>
                    </div>

                    <p className={styles.preview}>{thread.last_message_preview || "Sem prévia de mensagem."}</p>

                    <div className={styles.actionsRow}>
                      <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Filial</span>
                        <span className={styles.metaValue}>{branchName}</span>
                      </div>
                      <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Último ator</span>
                        <span className={styles.metaValue}>
                          {thread.last_actor === "staff"
                            ? "Equipe"
                            : thread.last_actor === "assistant"
                            ? "Assistente"
                            : "Cliente"}
                        </span>
                      </div>
                      <Link className={styles.openLink} href={`/admin/tickets/${thread.id}`}>
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
