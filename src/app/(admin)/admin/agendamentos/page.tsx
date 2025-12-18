"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, startOfYear, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/lib/db";

import { useAdminGuard, type AdminRole } from "../../useAdminGuard";
import layoutStyles from "../../adminHome.module.css";
import styles from "./agendamentos.module.css";

type ServiceTypeShape = { id?: string | null; name?: string | null } | null;

type ServiceAssignmentShape = {
  service_types?: ServiceTypeShape | ServiceTypeShape[] | null;
} | null;

type ServiceShape = {
  id?: string | null;
  name?: string | null;
  service_type_assignments?: ServiceAssignmentShape | ServiceAssignmentShape[] | null;
} | null;

type AppointmentRow = {
  id: string;
  branch_id: string | null;
  customer_id: string | null;
  starts_at: string;
  ends_at: string | null;
  status: string | null;
  service_id?: string | null;
  service_type_id?: string | null;
  services?: ServiceShape | ServiceShape[] | null;
  service_type?: ServiceTypeShape | ServiceTypeShape[] | null;
};

type CustomerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type NormalizedAppointment = {
  id: string;
  branchId: string | null;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  serviceName: string;
  serviceTypeName: string | null;
  techniqueName: string | null;
  startsAt: string;
  startDate: Date | null;
  status: AppointmentStatus;
};

type AppointmentStatus = "pending" | "reserved" | "confirmed" | "canceled" | "completed" | string;

type BranchAssignment = {
  branch_id: string | null;
  branches?: {
    name?: string | null;
  } | null;
};

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const normalizeStatusValue = (value: string | null | undefined): AppointmentStatus => {
  if (!value) return "pending";
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "pending";
  return normalized as AppointmentStatus;
};

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const extractServiceDetails = (
  services?: ServiceShape | ServiceShape[] | null,
  preferredServiceId?: string | null,
  preferredServiceTypeId?: string | null
): { serviceName: string | null; techniqueName: string | null } => {
  const candidates = toArray(services).filter((item): item is Exclude<ServiceShape, null> => Boolean(item) && typeof item === "object");
  const normalizedPreferredId = preferredServiceId?.toString().trim();
  const service =
    (normalizedPreferredId ? candidates.find((item) => item?.id?.toString().trim() === normalizedPreferredId) : undefined) ?? candidates[0];
  const rawServiceName = typeof service?.name === "string" ? service.name.trim() : "";

  const assignments = toArray(service?.service_type_assignments);
  const normalizedPreferredTypeId = preferredServiceTypeId?.toString().trim();

  const techniqueCandidates = assignments
    .flatMap((assignment) => toArray(assignment?.service_types))
    .filter((type): type is Exclude<ServiceTypeShape, null> => Boolean(type) && typeof type === "object");

  let techniqueName: string | null = null;
  if (normalizedPreferredTypeId) {
    const match = techniqueCandidates.find((type) => type?.id?.toString().trim() === normalizedPreferredTypeId);
    if (match && typeof match.name === "string") {
      const trimmed = match.name.trim();
      if (trimmed.length > 0) {
        techniqueName = trimmed;
      }
    }
  }

  if (!techniqueName) {
    const fallback = techniqueCandidates.map((type) => (typeof type?.name === "string" ? type.name.trim() : "")).find((name) => name.length > 0);
    techniqueName = fallback && fallback.length > 0 ? fallback : null;
  }

  return {
    serviceName: rawServiceName.length > 0 ? rawServiceName : null,
    techniqueName,
  };
};

const normalizeAppointment = (record: AppointmentRow, customers: Map<string, CustomerProfile>): NormalizedAppointment => {
  const startDate = parseDate(record.starts_at);
  const normalizedServiceTypeId = record.service_type_id?.toString().trim() ?? null;
  const storedServiceTypeCandidates = toArray(record.service_type).filter(
    (item): item is Exclude<ServiceTypeShape, null> => Boolean(item) && typeof item === "object"
  );

  let storedServiceTypeName: string | null = null;
  if (normalizedServiceTypeId) {
    const match = storedServiceTypeCandidates.find((item) => item?.id?.toString().trim() === normalizedServiceTypeId);
    if (match && typeof match.name === "string") {
      const trimmed = match.name.trim();
      if (trimmed.length > 0) {
        storedServiceTypeName = trimmed;
      }
    }
  }

  if (!storedServiceTypeName) {
    const fallback = storedServiceTypeCandidates
      .map((item) => (typeof item?.name === "string" ? item.name.trim() : ""))
      .find((name) => name.length > 0);
    storedServiceTypeName = fallback && fallback.length > 0 ? fallback : null;
  }

  const { serviceName, techniqueName: assignmentTechnique } = extractServiceDetails(
    record.services,
    record.service_id ?? null,
    normalizedServiceTypeId
  );

  const customer = record.customer_id ? customers.get(record.customer_id) : null;
  const customerName = customer?.full_name?.trim() || customer?.email?.trim() || "Cliente";
  const customerEmail = customer?.email?.trim() || null;
  const techniqueName = assignmentTechnique ?? storedServiceTypeName ?? null;
  const serviceLabel = serviceName ?? storedServiceTypeName ?? techniqueName ?? "Serviço";

  return {
    id: record.id,
    branchId: record.branch_id ?? null,
    customerId: record.customer_id,
    customerName,
    customerEmail,
    serviceName: serviceLabel,
    serviceTypeName: storedServiceTypeName,
    techniqueName,
    startsAt: record.starts_at,
    startDate,
    status: normalizeStatusValue(record.status),
  };
};

const formatDay = (date: Date | null) => {
  if (!date) return "—";
  return format(date, "dd/MM", { locale: ptBR });
};

const formatTime = (date: Date | null) => {
  if (!date) return "—";
  return format(date, "HH:mm", { locale: ptBR });
};

const STATUS_TONE: Record<string, "blue" | "green" | "orange" | "purple"> = {
  pending: "orange",
  reserved: "blue",
  confirmed: "green",
  completed: "purple",
  canceled: "orange",
};

const nextMonthsRange = () => endOfMonth(addMonths(new Date(), 2));

const statusKey = (value: AppointmentStatus) => value?.toString().toLowerCase();

export default function AdminAppointmentsPage() {
  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [appointments, setAppointments] = useState<NormalizedAppointment[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [metricsRange, setMetricsRange] = useState<"7d" | "30d" | "year">("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authorized") return;
    let active = true;

    const loadBranchScope = async (currentRole: AdminRole | "client" | null) => {
      const { data: userResponse } = await supabase.auth.getUser();
      const userId = userResponse.user?.id;
      if (!userId) return { branchId: null as string | null, branchName: null as string | null };

      const { data: branchAssignments } = await supabase
        .from("branch_admins")
        .select("branch_id, branches(name)")
        .eq("user_id", userId)
        .limit(5)
        .returns<BranchAssignment[]>();

      const primaryAssignment = branchAssignments?.[0];
      const scopedBranchId = primaryAssignment?.branch_id ?? null;
      const scopedBranchName = primaryAssignment?.branches?.name ?? null;

      if (currentRole === "admin") {
        return { branchId: scopedBranchId, branchName: scopedBranchName };
      }

      return {
        branchId: scopedBranchId,
        branchName: scopedBranchName,
      };
    };

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { branchId: scopedBranchId, branchName: scopedBranchName } = await loadBranchScope(role);
        const startDate = startOfYear(new Date());
        const endDate = nextMonthsRange();

        const appointmentsQuery = supabase
          .from("appointments")
          .select(
            "id, branch_id, customer_id, starts_at, ends_at, status, service_id, service_type_id, services(id, name, service_type_assignments(service_types(id, name))), service_type:service_types!appointments_service_type_id_fkey(id, name)"
          )
          .gte("starts_at", startDate.toISOString())
          .lte("starts_at", endDate.toISOString())
          .not("status", "eq", "canceled")
          .order("starts_at", { ascending: true });

        const { data: appointmentRows, error: appointmentsError } = scopedBranchId
          ? await appointmentsQuery.eq("branch_id", scopedBranchId)
          : await appointmentsQuery;

        if (appointmentsError) {
          throw appointmentsError;
        }

        const customerIds = Array.from(
          new Set((appointmentRows ?? []).map((row) => row.customer_id).filter(Boolean) as string[])
        );

        const customers = new Map<string, CustomerProfile>();
        if (customerIds.length > 0) {
          const { data: customerRows, error: customersError } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", customerIds)
            .returns<CustomerProfile[]>();

          if (customersError) {
            throw customersError;
          }

          for (const profile of customerRows ?? []) {
            customers.set(profile.id, profile);
          }
        }

        const normalizedAppointments = (appointmentRows ?? []).map((row) => normalizeAppointment(row, customers));
        if (!active) return;
        setAppointments(normalizedAppointments);
        setBranchId(scopedBranchId);
        setBranchName(scopedBranchName);
      } catch (err) {
        if (!active) return;
        console.error("Erro ao carregar agendamentos do admin", err);
        setError("Não foi possível carregar os agendamentos agora.");
        setAppointments([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [role, status]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    return days.map((date) => ({
      date,
      key: date.toISOString(),
      outOfMonth: !isSameMonth(date, monthStart),
      events: appointments.filter((appt) => appt.startDate && isSameDay(appt.startDate, date)),
    }));
  }, [appointments, visibleMonth]);

  const upcomingAppointments = useMemo(() => {
    const cutoff = new Date();
    return appointments
      .filter(
        (appt) =>
          appt.startDate &&
          appt.startDate.getTime() >= cutoff.getTime() &&
          !["canceled", "completed"].includes(statusKey(appt.status))
      )
      .sort((a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        return a.startDate.getTime() - b.startDate.getTime();
      });
  }, [appointments]);

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return appointments
      .filter((appt) => appt.startDate && isSameDay(appt.startDate, selectedDate))
      .sort((a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        return a.startDate.getTime() - b.startDate.getTime();
      });
  }, [appointments, selectedDate]);

  const selectedDayLabel = useMemo(
    () => (selectedDate ? format(selectedDate, "d 'de' MMMM", { locale: ptBR }) : "Selecione um dia"),
    [selectedDate]
  );

  const selectedDayWeekday = useMemo(
    () => (selectedDate ? format(selectedDate, "EEEE", { locale: ptBR }) : ""),
    [selectedDate]
  );

  const metricsRangeStart = useMemo(() => {
    const today = new Date();
    if (metricsRange === "7d") return subDays(today, 7);
    if (metricsRange === "30d") return subDays(today, 30);
    return startOfYear(today);
  }, [metricsRange]);

  const metricsAppointments = useMemo(
    () =>
      appointments.filter(
        (appt) =>
          appt.startDate &&
          appt.startDate >= metricsRangeStart &&
          !["canceled"].includes(statusKey(appt.status))
      ),
    [appointments, metricsRangeStart]
  );

  const serviceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appt of metricsAppointments) {
      const key = appt.serviceName || "Serviço";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [metricsAppointments]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appt of metricsAppointments) {
      const key = appt.serviceTypeName || appt.techniqueName || "Tipo";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [metricsAppointments]);

  const monthlyCounts = useMemo(() => {
    const months = [] as { label: string; value: number }[];
    const today = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const monthDate = addMonths(startOfMonth(today), -i);
      const label = format(monthDate, "LLL", { locale: ptBR });
      const value = metricsAppointments.filter(
        (appt) =>
          appt.startDate &&
          appt.startDate.getMonth() === monthDate.getMonth() &&
          appt.startDate.getFullYear() === monthDate.getFullYear()
      ).length;
      months.push({ label, value });
    }
    return months;
  }, [metricsAppointments]);

  const maxServiceCount = Math.max(1, ...serviceCounts.map((item) => item.value), ...typeCounts.map((item) => item.value));
  const maxMonthly = Math.max(1, ...monthlyCounts.map((item) => item.value));

  if (status !== "authorized") {
    return <div className={styles.loading}>Carregando painel…</div>;
  }

  return (
    <div className={layoutStyles.dashboard}>
      <div className={layoutStyles.pageTop}>
        <div>
          <p className={layoutStyles.pageBreadcrumb}>Dashboard / Agendamentos</p>
          <h1 className={layoutStyles.pageTitle}>Agenda por filial</h1>
          {branchName ? <p className={styles.pageSubtitle}>Filial ativa: {branchName}</p> : null}
        </div>
        <div className={styles.topChips}>
          <span className={styles.scopeChip}>
            {branchId ? "Filial atribuída" : "Todas as filiais"}
          </span>
        </div>
      </div>

      <div className={layoutStyles.heroCards}>
        <section className={layoutStyles.card}>
          <header className={layoutStyles.cardHeader}>
            <div>
              <p className={layoutStyles.cardEyebrow}>Calendário</p>
              <h2>Agendamentos marcados</h2>
            </div>
            <div className={styles.calendarControls}>
              <button type="button" className={styles.pillButton} onClick={() => setVisibleMonth((prev) => addMonths(prev, -1))}>
                ◀
              </button>
              <span className={styles.calendarLabel}>{format(visibleMonth, "LLLL yyyy", { locale: ptBR })}</span>
              <button type="button" className={styles.pillButton} onClick={() => setVisibleMonth((prev) => addMonths(prev, 1))}>
                ▶
              </button>
            </div>
          </header>
          <div className={styles.calendarGrid} role="grid" aria-label="Calendário de agendamentos">
            {calendarDays.map((day) => (
              <div
                key={day.key}
                className={`${styles.calendarDay} ${day.outOfMonth ? styles.calendarDayMuted : ""} ${
                  selectedDate && isSameDay(day.date, selectedDate) ? styles.calendarDaySelected : ""
                }`}
                aria-label={`Dia ${format(day.date, "dd/MM", { locale: ptBR })}`}
                tabIndex={0}
                role="gridcell"
                aria-selected={selectedDate ? isSameDay(day.date, selectedDate) : false}
                onClick={() => setSelectedDate(day.date)}
                onKeyDown={(evt) => {
                  if (evt.key === "Enter" || evt.key === " ") {
                    evt.preventDefault();
                    setSelectedDate(day.date);
                  }
                }}
              >
                <div className={styles.calendarDayHeader}>
                  <span className={styles.calendarDate}>{format(day.date, "d", { locale: ptBR })}</span>
                  <span className={styles.calendarWeekday}>{format(day.date, "EEE", { locale: ptBR })}</span>
                </div>
                <div className={styles.calendarDayEvents}>
                  {day.events.length === 0 ? <span className={styles.calendarEmpty}>Sem horários</span> : null}
                  {day.events.slice(0, 3).map((event) => {
                    const tone = STATUS_TONE[statusKey(event.status)] ?? "blue";
                    return (
                      <span
                        key={event.id}
                        className={`${styles.calendarBadge} ${styles[`tone-${tone}`]}`}
                        title={`${event.customerName} · ${event.serviceName}`}
                      >
                        <span className={styles.badgeDot} aria-hidden />
                        <span className={styles.badgeText}>{event.customerName}</span>
                        <span className={styles.badgeTime}>{formatTime(event.startDate)}</span>
                      </span>
                    );
                  })}
                  {day.events.length > 3 ? <span className={styles.calendarMore}>+{day.events.length - 3} outros</span> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={`${layoutStyles.card} ${layoutStyles.feedCard}`}>
          <header className={layoutStyles.cardHeader}>
            <div>
              <p className={layoutStyles.cardEyebrow}>Horários do dia</p>
              <h2>{selectedDayLabel}</h2>
              <p className={styles.feedHint}>
                {selectedDate ? selectedDayWeekday : "Selecione um dia no calendário para ver os horários."}
              </p>
            </div>
          </header>
          <div className={`${layoutStyles.feedList} ${styles.dayScheduleList}`}>
            {selectedDayAppointments.length === 0 ? (
              <p className={styles.emptyState}>
                {selectedDate ? "Nenhum horário para este dia." : "Selecione um dia no calendário para ver os horários."}
              </p>
            ) : null}
            {selectedDayAppointments.map((appt) => (
              <div key={appt.id} className={layoutStyles.feedItem}>
                <span className={`${layoutStyles.feedIcon} ${layoutStyles[`tone-${STATUS_TONE[statusKey(appt.status)] ?? "blue"}`]}`} aria-hidden />
                <div className={layoutStyles.feedCopy}>
                  <p className={layoutStyles.feedTitle}>{appt.customerName}</p>
                  <p className={layoutStyles.feedDesc}>
                    {appt.serviceName}
                    {appt.techniqueName ? ` · ${appt.techniqueName}` : ""}
                  </p>
                </div>
                <span className={layoutStyles.feedTime}>
                  {formatTime(appt.startDate)} {appt.serviceTypeName ? `· ${appt.serviceTypeName}` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={layoutStyles.card}>
        <header className={layoutStyles.cardHeader}>
          <div>
            <p className={layoutStyles.cardEyebrow}>Agendamentos</p>
            <h2>Ordem cronológica</h2>
          </div>
        </header>
        <div className={layoutStyles.tableWrapper}>
          <table className={layoutStyles.table}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Técnica</th>
                <th>Data</th>
                <th>Horário</th>
              </tr>
            </thead>
            <tbody>
              {upcomingAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className={layoutStyles.mutedCell}>
                    Nenhum agendamento futuro para mostrar.
                  </td>
                </tr>
              ) : null}
              {upcomingAppointments.map((appt) => (
                <tr key={appt.id}>
                  <td>
                    <div className={layoutStyles.clientCell}>
                      <span className={layoutStyles.avatarSmall} aria-hidden>
                        {appt.customerName.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <p className={layoutStyles.clientName}>{appt.customerName}</p>
                        <p className={layoutStyles.clientEmail}>{appt.customerEmail ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className={layoutStyles.valueCell}>{appt.serviceName}</td>
                  <td className={layoutStyles.mutedCell}>{appt.serviceTypeName ?? "—"}</td>
                  <td className={layoutStyles.mutedCell}>{appt.techniqueName ?? "—"}</td>
                  <td>{formatDay(appt.startDate)}</td>
                  <td>{formatTime(appt.startDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.metricsRow}>
        <section className={layoutStyles.card}>
          <header className={layoutStyles.cardHeader}>
            <div>
              <p className={layoutStyles.cardEyebrow}>Métricas</p>
              <h2>Serviços e tipos por período</h2>
            </div>
          </header>

          <div className={styles.metricPairGrid}>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Serviços no período</p>
              <p className={styles.metricValue}>{metricsAppointments.length}</p>
              <div className={styles.barList}>
                {serviceCounts.map((item) => (
                  <div key={item.label} className={styles.barItem}>
                    <span className={styles.barLabel}>{item.label}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${(item.value / maxServiceCount) * 100}%` }} />
                    </div>
                    <span className={styles.barValue}>{item.value}</span>
                  </div>
                ))}
                {serviceCounts.length === 0 ? <p className={styles.mutedCell}>Nenhum serviço no período selecionado.</p> : null}
              </div>
            </div>

            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Tipos e técnicas</p>
              <p className={styles.metricValue}>{typeCounts.reduce((sum, item) => sum + item.value, 0)}</p>
              <div className={styles.barList}>
                {typeCounts.map((item) => (
                  <div key={item.label} className={styles.barItem}>
                    <span className={styles.barLabel}>{item.label}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFillAlt} style={{ width: `${(item.value / maxServiceCount) * 100}%` }} />
                    </div>
                    <span className={styles.barValue}>{item.value}</span>
                  </div>
                ))}
                {typeCounts.length === 0 ? <p className={styles.mutedCell}>Nenhuma técnica encontrada.</p> : null}
              </div>
            </div>
          </div>
        </section>

        <section className={layoutStyles.card}>
          <header className={layoutStyles.cardHeader}>
            <div>
              <p className={layoutStyles.cardEyebrow}>Distribuição mensal</p>
              <h2>Agendamentos por mês</h2>
            </div>
            <div className={styles.pillSwitcher} role="group" aria-label="Período das métricas">
              <button
                type="button"
                className={`${styles.pillButton} ${metricsRange === "7d" ? styles.pillButtonActive : ""}`}
                onClick={() => setMetricsRange("7d")}
              >
                7 dias
              </button>
              <button
                type="button"
                className={`${styles.pillButton} ${metricsRange === "30d" ? styles.pillButtonActive : ""}`}
                onClick={() => setMetricsRange("30d")}
              >
                30 dias
              </button>
              <button
                type="button"
                className={`${styles.pillButton} ${metricsRange === "year" ? styles.pillButtonActive : ""}`}
                onClick={() => setMetricsRange("year")}
              >
                Ano
              </button>
            </div>
          </header>

          <div className={styles.monthlyCardBody}>
            <div className={styles.monthlyChart} role="img" aria-label="Distribuição mensal de agendamentos">
              {monthlyCounts.map((item) => (
                <div key={item.label} className={styles.monthlyBarGroup}>
                  <div className={styles.monthlyBarTrack}>
                    <div className={styles.monthlyBarFill} style={{ height: `${(item.value / maxMonthly) * 100}%` }} />
                  </div>
                  <span className={styles.monthlyLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      {error ? <div className={layoutStyles.error}>{error}</div> : null}
      {loading ? <div className={layoutStyles.loading}>Carregando agendamentos…</div> : null}
    </div>
  );
}
