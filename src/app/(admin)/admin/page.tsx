"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminCard } from "../@components/ui/AdminCard";
import { AdminStatCard } from "../@components/ui/AdminStatCard";
import { AdminTable } from "../@components/ui/AdminTable";
import { AdminToolbar } from "../@components/ui/AdminToolbar";
import { useAdminBranch } from "../@components/AdminBranchContext";
import { NAV_ITEMS } from "../@components/AdminNav";
import { useAdminGuard } from "../useAdminGuard";
import { supabase } from "@/lib/db";
import styles from "../adminHome.module.css";

type DashboardAppointment = {
  id: string;
  starts_at: string;
  status: string;
  serviceName: string;
  customerName: string;
};

type DashboardClient = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default function AdminHomePage() {
  const { status, role } = useAdminGuard({
    allowedRoles: ["admin"],
    fallbackRedirects: {
      adminsuper: "/admin/adminsuper",
      adminmaster: "/admin/adminmaster",
      client: "/login",
      unauthenticated: "/login",
    },
  });
  const { activeBranchId, branchScope, loading: branchLoading } = useAdminBranch();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointmentsToday, setAppointmentsToday] = useState<DashboardAppointment[]>([]);
  const [recentClients, setRecentClients] = useState<DashboardClient[]>([]);
  const [clientsCount, setClientsCount] = useState(0);
  const [servicesCount, setServicesCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [appointmentSearch, setAppointmentSearch] = useState("");

  const requiresBranch = role === "admin" || role === "adminsuper";
  const hasBranchSelected = branchScope === "branch" && Boolean(activeBranchId);
  const branchGuardMessage = branchScope === "no_branch" ? null : requiresBranch && !hasBranchSelected ? "Selecione uma filial para ver os dados." : null;

  const isAuthorized = status === "authorized";

  const fetchDashboard = useCallback(async () => {
    if (!isAuthorized || branchGuardMessage || branchLoading) return;

    setLoading(true);
    setError(null);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const branchFilterId = branchScope === "branch" ? activeBranchId : null;
    const branchNoFilter = branchScope === "no_branch";

    try {
      let appointmentsQuery = supabase
        .from("appointments")
        .select(
          "id, starts_at, status, branch_id, services:services(name), profiles:profiles!appointments_customer_id_fkey(full_name)"
        )
        .gte("starts_at", todayStart.toISOString())
        .lte("starts_at", todayEnd.toISOString())
        .order("starts_at", { ascending: true })
        .limit(12);

      if (branchFilterId) {
        appointmentsQuery = appointmentsQuery.eq("branch_id", branchFilterId);
      }

      if (branchNoFilter) {
        appointmentsQuery = appointmentsQuery.is("branch_id", null);
      }

      const clientsQuery = supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "client")
        .order("created_at", { ascending: false })
        .limit(6);

      const clientsCountQuery = supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client");

      let servicesCountQuery = supabase.from("services").select("id", { count: "exact", head: true });
      if (branchFilterId) {
        servicesCountQuery = servicesCountQuery.eq("branch_id", branchFilterId);
      }
      if (branchNoFilter) {
        servicesCountQuery = servicesCountQuery.is("branch_id", null);
      }

      const [{ data: appointmentsData, error: appointmentsError }, { data: clientsData, error: clientsError }, { count: clientsCountResult, error: clientsCountError }, { count: servicesCountResult, error: servicesError }] = await Promise.all([
        appointmentsQuery,
        clientsQuery,
        clientsCountQuery,
        servicesCountQuery,
      ]);

      if (appointmentsError || clientsError || clientsCountError || servicesError) {
        throw new Error("Não foi possível carregar o dashboard do admin.");
      }

      const normalizedAppointments = (appointmentsData ?? []).map((appointment) => ({
        id: appointment.id,
        starts_at: appointment.starts_at,
        status: appointment.status ?? "pending",
        serviceName: Array.isArray(appointment.services)
          ? appointment.services[0]?.name ?? "Serviço"
          : appointment.services?.name ?? "Serviço",
        customerName: Array.isArray(appointment.profiles)
          ? appointment.profiles[0]?.full_name ?? "Cliente"
          : appointment.profiles?.full_name ?? "Cliente",
      }));

      const normalizedClients = (clientsData ?? []).map((client) => ({
        id: client.id,
        full_name: client.full_name,
        email: client.email,
      }));

      setAppointmentsToday(normalizedAppointments);
      setRecentClients(normalizedClients);
      setClientsCount(clientsCountResult ?? normalizedClients.length);
      setServicesCount(servicesCountResult ?? 0);
      setPendingCount(normalizedAppointments.filter((appt) => appt.status === "pending").length);
      setConfirmedCount(normalizedAppointments.filter((appt) => appt.status === "confirmed" || appt.status === "reserved").length);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao carregar o resumo do admin.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, branchGuardMessage, branchLoading, branchScope, isAuthorized]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const quickLinks = useMemo(() => NAV_ITEMS.filter((item) => !item.href.includes("suporte")), []);

  const normalizedSearch = appointmentSearch.trim().toLowerCase();
  const filteredAppointmentsToday = useMemo(
    () =>
      normalizedSearch
        ? appointmentsToday.filter((appointment) =>
            `${appointment.customerName} ${appointment.serviceName}`.toLowerCase().includes(normalizedSearch)
          )
        : appointmentsToday,
    [appointmentsToday, normalizedSearch]
  );

  const appointmentRows = filteredAppointmentsToday.map((appointment) => ({
    key: appointment.id,
    cells: [
      <strong key="service">{appointment.serviceName}</strong>,
      appointment.customerName,
      new Date(appointment.starts_at).toLocaleString(),
      appointment.status,
    ],
  }));

  const clientRows = recentClients.map((client) => ({
    key: client.id,
    cells: [client.full_name ?? "Cliente", client.email ?? "—"],
  }));

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div>
          <p className={styles.eyebrow}>Painel Admin</p>
          <h2 className={styles.title}>Dashboard operacional</h2>
          <p className={styles.subtitle}>
            Resumo rápido dos agendamentos, clientes e catálogo. A navegação lateral continua disponível para os módulos completos.
          </p>
        </div>
        <div className={styles.statGrid}>
          <AdminStatCard label="Agendamentos do dia" value={appointmentsToday.length} hint={branchGuardMessage ?? ""} />
          <AdminStatCard label="Pendentes" value={pendingCount} icon="⏳" />
          <AdminStatCard label="Confirmados/Reservados" value={confirmedCount} icon="✅" />
          <AdminStatCard label="Serviços ativos" value={servicesCount} icon="🧾" />
          <AdminStatCard label="Clientes" value={clientsCount} icon="🧑‍🤝‍🧑" />
        </div>
      </div>

      {branchGuardMessage ? (
        <AdminCard title="Selecione uma filial" description={branchGuardMessage}>
          <p className={styles.placeholderCopy}>Use o seletor no topo para escolher a unidade e liberar o dashboard.</p>
        </AdminCard>
      ) : (
        <div className={styles.gridColumns}>
          <AdminCard
            title="Agendamentos do dia"
            description="Status e horários das próximas reservas."
            actions={<span className={styles.badge}>{loading ? "Carregando…" : "Atualizado"}</span>}
          >
            <AdminToolbar
              searchPlaceholder="Buscar agendamento"
              searchValue={appointmentSearch}
              onSearchChange={setAppointmentSearch}
            >
              <span className={styles.pill}>{filteredAppointmentsToday.length} itens</span>
            </AdminToolbar>
            <AdminTable
              columns={[
                { key: "service", label: "Serviço" },
                { key: "customer", label: "Cliente" },
                { key: "start", label: "Início" },
                { key: "status", label: "Status" },
              ]}
              rows={appointmentRows}
              emptyMessage={loading ? "Carregando agendamentos…" : "Nenhum agendamento para hoje."}
            />
          </AdminCard>

          <AdminCard title="Clientes recentes" description="Últimos cadastros na base.">
            <AdminTable
              columns={[
                { key: "name", label: "Nome" },
                { key: "email", label: "E-mail" },
              ]}
              rows={clientRows}
              emptyMessage={loading ? "Carregando clientes…" : "Nenhum cliente encontrado."}
            />
          </AdminCard>

          <AdminCard title="Acessos rápidos" description="Atalhos para os módulos principais." variant="muted">
            <div className={styles.quickLinks}>
              {quickLinks.map((item) => (
                <Link key={item.href} href={item.href} className={styles.quickLink}>
                  <span className={styles.quickIcon}>{item.icon}</span>
                  <div>
                    <p className={styles.quickTitle}>{item.label}</p>
                    <p className={styles.quickSubtitle}>{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </AdminCard>
        </div>
      )}

      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
}
