"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/lib/db";
import { DEFAULT_SLOT_TEMPLATE } from "@/lib/availability";

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

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  reserved: "Reservado",
  confirmed: "Confirmado",
  canceled: "Cancelado",
  completed: "Finalizado",
  refunded: "Reembolsado",
};

const nextMonthsRange = () => endOfMonth(addMonths(new Date(), 2));

const statusKey = (value: AppointmentStatus) => value?.toString().toLowerCase();

type AppointmentFilterKey = "upcoming" | "all" | "confirmed" | "pending" | "canceled" | "completed";

const FILTER_OPTIONS: Array<{
  key: AppointmentFilterKey;
  label: string;
  statuses?: AppointmentStatus[];
  upcomingOnly?: boolean;
}> = [
  { key: "upcoming", label: "Próximos", statuses: ["pending", "reserved", "confirmed"], upcomingOnly: true },
  { key: "all", label: "Todos" },
  { key: "confirmed", label: "Confirmados", statuses: ["reserved", "confirmed"] },
  { key: "pending", label: "Pendentes", statuses: ["pending"] },
  { key: "canceled", label: "Cancelados", statuses: ["canceled"] },
  { key: "completed", label: "Finalizados", statuses: ["completed"] },
];

const CALENDAR_ACTIVE_STATUSES = new Set(["pending", "reserved", "confirmed"]);

const CALENDAR_STATE_LABELS: Record<"available" | "partial" | "full" | "past", string> = {
  available: "livre",
  partial: "parcial",
  full: "lotado",
  past: "passado",
};

const formatStatusLabel = (status: AppointmentStatus) => {
  const key = statusKey(status);
  if (!key) return "Pendente";
  return STATUS_LABELS[key] ?? "Pendente";
};

export default function AdminAppointmentsPage() {
  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [appointments, setAppointments] = useState<NormalizedAppointment[]>([]);
  const [branchScope, setBranchScope] = useState<{ ids: string[]; label: string | null }>({ ids: [], label: null });
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [metricsRange, setMetricsRange] = useState<"7d" | "30d" | "60d" | "90d" | "year" | "custom" | "all">("30d");
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [selectedFilter, setSelectedFilter] = useState<AppointmentFilterKey>("upcoming");
  const [filterOpen, setFilterOpen] = useState(false);
  const [distributionFilter, setDistributionFilter] = useState<"total" | "services" | "techniques">("total");
  const [distributionFilterOpen, setDistributionFilterOpen] = useState(false);
  const [distributionMenu, setDistributionMenu] = useState<"root" | "services" | "techniques">("root");
  const [selectedDistributionService, setSelectedDistributionService] = useState<string | null>(null);
  const [selectedDistributionTechnique, setSelectedDistributionTechnique] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const distributionFilterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status !== "authorized") return;
    let active = true;

    const loadBranchScope = async (currentRole: AdminRole | "client" | null) => {
      const { data: userResponse } = await supabase.auth.getUser();
      const userId = userResponse.user?.id;
      if (!userId) return { ids: [] as string[], label: null as string | null };

      const { data: branchAssignments } = await supabase
        .from("branch_admins")
        .select("branch_id, branches(name)")
        .eq("user_id", userId)
        .limit(50)
        .returns<BranchAssignment[]>();

      const assignmentIds = new Map<string, string | null>();
      for (const assignment of branchAssignments ?? []) {
        if (!assignment?.branch_id) continue;
        assignmentIds.set(assignment.branch_id, assignment.branches?.name ?? null);
      }

      const ownedBranches =
        currentRole === "adminsuper"
          ? (
              await supabase
                .from("branches")
                .select("id, name")
                .eq("owner_id", userId)
                .limit(50)
            ).data ?? []
          : [];

      if (ownedBranches.length > 0) {
        for (const branch of ownedBranches) {
          if (!branch?.id) continue;
          assignmentIds.set(branch.id, branch.name ?? assignmentIds.get(branch.id) ?? null);
        }
      }

      const ids = currentRole === "adminmaster" ? [] : Array.from(new Set([...assignmentIds.keys()]));
      let label: string | null = null;

      if (currentRole === "adminmaster") {
        label = "Todas as filiais";
      } else if (ids.length === 1) {
        label = assignmentIds.get(ids[0]) ?? null;
      } else if (ids.length > 1) {
        label = "Filiais atribuídas";
      }

      return { ids, label };
    };

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const scopedBranchScope = await loadBranchScope(role);
        const startDate = startOfYear(new Date());
        const endDate = nextMonthsRange();

        const appointmentsQuery = supabase
          .from("appointments")
          .select(
            "id, branch_id, customer_id, starts_at, ends_at, status, service_id, service_type_id, services(id, name, service_type_assignments(service_types(id, name))), service_type:service_types!appointments_service_type_id_fkey(id, name)"
          )
          .gte("starts_at", startDate.toISOString())
          .lte("starts_at", endDate.toISOString())
          .order("starts_at", { ascending: true });

        const { data: appointmentRows, error: appointmentsError } = scopedBranchScope.ids.length
          ? await appointmentsQuery.in("branch_id", scopedBranchScope.ids)
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
        setBranchScope(scopedBranchScope);
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

  useEffect(() => {
    if (!filterOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!filterMenuRef.current) return;
      if (!filterMenuRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [filterOpen]);

  useEffect(() => {
    if (!distributionFilterOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!distributionFilterRef.current) return;
      if (!distributionFilterRef.current.contains(event.target as Node)) {
        setDistributionFilterOpen(false);
        setDistributionMenu("root");
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDistributionFilterOpen(false);
        setDistributionMenu("root");
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [distributionFilterOpen]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const today = startOfDay(new Date());
    const slotsPerDay = DEFAULT_SLOT_TEMPLATE.length;

    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    return days.map((date) => {
      const eventsCount = appointments.filter(
        (appt) =>
          appt.startDate &&
          isSameDay(appt.startDate, date) &&
          CALENDAR_ACTIVE_STATUSES.has(statusKey(appt.status))
      ).length;
      const isPast = date < today;
      let state: "available" | "partial" | "full" | "past" = "available";

      if (isPast) {
        state = "past";
      } else if (eventsCount === 0) {
        state = "available";
      } else if (eventsCount >= slotsPerDay) {
        state = "full";
      } else {
        state = "partial";
      }

      return {
        date,
        key: date.toISOString(),
        outOfMonth: !isSameMonth(date, monthStart),
        state,
      };
    });
  }, [appointments, visibleMonth]);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate.getTime() - b.startDate.getTime();
    });
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    const activeFilter = FILTER_OPTIONS.find((option) => option.key === selectedFilter);
    if (!activeFilter) return sortedAppointments;
    const statusSet = activeFilter.statuses ? new Set(activeFilter.statuses.map((value) => statusKey(value))) : null;
    const now = new Date();

    return sortedAppointments.filter((appt) => {
      const normalizedStatus = statusKey(appt.status);
      if (activeFilter.upcomingOnly) {
        if (!appt.startDate || appt.startDate.getTime() < now.getTime()) {
          return false;
        }
      }
      if (!statusSet) return true;
      return statusSet.has(normalizedStatus);
    });
  }, [selectedFilter, sortedAppointments]);

  const selectedFilterLabel = useMemo(
    () => FILTER_OPTIONS.find((option) => option.key === selectedFilter)?.label ?? "Próximos",
    [selectedFilter]
  );

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

  const metricsRangeWindow = useMemo(() => {
    const today = new Date();
    if (metricsRange === "7d") return { start: subDays(today, 7), end: today };
    if (metricsRange === "30d") return { start: subDays(today, 30), end: today };
    if (metricsRange === "60d") return { start: subDays(today, 60), end: today };
    if (metricsRange === "90d") return { start: subDays(today, 90), end: today };
    if (metricsRange === "year") return { start: startOfYear(today), end: today };
    if (metricsRange === "custom") {
      const start = customRange.start ? startOfDay(new Date(customRange.start)) : null;
      const end = customRange.end ? endOfDay(new Date(customRange.end)) : null;
      return {
        start: start && !Number.isNaN(start.getTime()) ? start : null,
        end: end && !Number.isNaN(end.getTime()) ? end : null,
      };
    }
    return { start: null, end: null };
  }, [customRange.end, customRange.start, metricsRange]);

  const periodAppointments = useMemo(
    () =>
      appointments.filter((appt) => {
        if (!appt.startDate) return false;
        if (metricsRangeWindow.start && appt.startDate < metricsRangeWindow.start) return false;
        if (metricsRangeWindow.end && appt.startDate > metricsRangeWindow.end) return false;
        return true;
      }),
    [appointments, metricsRangeWindow.end, metricsRangeWindow.start]
  );

  const metricsAppointments = useMemo(
    () => periodAppointments.filter((appt) => !["canceled"].includes(statusKey(appt.status))),
    [periodAppointments]
  );

  const distributionAppointments = useMemo(() => {
    if (distributionFilter === "services" && selectedDistributionService) {
      return metricsAppointments.filter((appt) => appt.serviceName === selectedDistributionService);
    }
    if (distributionFilter === "techniques" && selectedDistributionTechnique) {
      return metricsAppointments.filter(
        (appt) => (appt.techniqueName?.trim() || "Sem técnica") === selectedDistributionTechnique
      );
    }
    return metricsAppointments;
  }, [distributionFilter, metricsAppointments, selectedDistributionService, selectedDistributionTechnique]);

  const distributionServices = useMemo(() => {
    const unique = new Set<string>();
    metricsAppointments.forEach((appt) => {
      if (appt.serviceName?.trim()) {
        unique.add(appt.serviceName.trim());
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [metricsAppointments]);

  const distributionTechniques = useMemo(() => {
    const unique = new Set<string>();
    metricsAppointments.forEach((appt) => {
      const name = appt.techniqueName?.trim() || "Sem técnica";
      unique.add(name);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [metricsAppointments]);

  const activeAppointments = useMemo(
    () => periodAppointments.filter((appt) => !["completed", "canceled"].includes(statusKey(appt.status))),
    [periodAppointments]
  );

  const confirmedAppointments = useMemo(
    () => periodAppointments.filter((appt) => ["confirmed", "reserved"].includes(statusKey(appt.status))),
    [periodAppointments]
  );

  const pendingAppointments = useMemo(
    () => periodAppointments.filter((appt) => statusKey(appt.status) === "pending"),
    [periodAppointments]
  );

  const canceledAppointments = useMemo(
    () => periodAppointments.filter((appt) => statusKey(appt.status) === "canceled"),
    [periodAppointments]
  );

  const refundedAppointments = useMemo(
    () => periodAppointments.filter((appt) => statusKey(appt.status) === "refunded"),
    [periodAppointments]
  );

  const completedAppointments = useMemo(
    () => periodAppointments.filter((appt) => statusKey(appt.status) === "completed"),
    [periodAppointments]
  );

  const metricBreakdown = useMemo(
    () => [
      { key: "agendamentos", label: "Agendamentos", value: activeAppointments.length, color: "#6ad4ff" },
      { key: "confirmados", label: "Confirmados", value: confirmedAppointments.length, color: "#62a07e" },
      { key: "pendentes", label: "Pendentes", value: pendingAppointments.length, color: "#f3a451" },
      { key: "cancelados", label: "Cancelados", value: canceledAppointments.length, color: "#d96a6a" },
      { key: "reembolsados", label: "Reembolsados", value: refundedAppointments.length, color: "#ff7b96" },
      { key: "concluidos", label: "Concluídos", value: completedAppointments.length, color: "#7d6bff" },
    ],
    [activeAppointments.length, canceledAppointments.length, completedAppointments.length, confirmedAppointments.length, pendingAppointments.length, refundedAppointments.length]
  );

  const distributionBreakdown = useMemo(() => {
    if (distributionFilter === "total") {
      return metricBreakdown;
    }
    const palette = ["#6ad4ff", "#62a07e", "#f3a451", "#d96a6a", "#ff7b96", "#7d6bff", "#55b9c7", "#ffb347", "#7bd389"];
    const counts = new Map<string, number>();
    if (distributionFilter === "services") {
      distributionAppointments.forEach((appt) => {
        const label = appt.serviceName?.trim() || "Serviço";
        counts.set(label, (counts.get(label) ?? 0) + 1);
      });
    } else {
      distributionAppointments.forEach((appt) => {
        const label = appt.techniqueName?.trim() || "Sem técnica";
        counts.set(label, (counts.get(label) ?? 0) + 1);
      });
    }
    return Array.from(counts.entries())
      .map(([label, value], index) => ({
        key: label.toLowerCase().replace(/\s+/g, "-"),
        label,
        value,
        color: palette[index % palette.length],
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
  }, [distributionAppointments, distributionFilter, metricBreakdown]);

  const distributionTotal = useMemo(
    () => distributionBreakdown.reduce((sum, item) => sum + item.value, 0),
    [distributionBreakdown]
  );

  const pieBackground = useMemo(() => {
    if (distributionTotal <= 0) {
      return "conic-gradient(#eef3fb 0deg 360deg)";
    }
    let current = 0;
    const slices = distributionBreakdown.map((item) => {
      const start = current;
      const portion = (item.value / distributionTotal) * 100;
      const end = start + portion;
      current = end;
      return `${item.color} ${start}% ${end}%`;
    });
    return `conic-gradient(${slices.join(", ")})`;
  }, [distributionBreakdown, distributionTotal]);

  const distributionFilterLabel = useMemo(() => {
    if (distributionFilter === "services") {
      return selectedDistributionService ?? "Serviços";
    }
    if (distributionFilter === "techniques") {
      return selectedDistributionTechnique ?? "Técnicas";
    }
    return "Total";
  }, [distributionFilter, selectedDistributionService, selectedDistributionTechnique]);
  const calendarStateClasses: Record<"available" | "partial" | "full" | "past", string> = {
    available: styles.calendarDayAvailable,
    partial: styles.calendarDayPartial,
    full: styles.calendarDayFull,
    past: styles.calendarDayPast,
  };

  if (status !== "authorized") {
    return <div className={styles.loading}>Carregando painel…</div>;
  }

  return (
    <div className={layoutStyles.dashboard}>
      <div className={layoutStyles.pageTop}>
        <div>
          <p className={layoutStyles.pageBreadcrumb}>Dashboard / Agendamentos</p>
          <h1 className={layoutStyles.pageTitle}>Agenda por filial</h1>
          {branchScope.label ? <p className={styles.pageSubtitle}>Filial ativa: {branchScope.label}</p> : null}
        </div>
        <div className={styles.topChips}>
          <span className={styles.scopeChip}>
            {branchScope.ids.length ? (branchScope.ids.length === 1 ? "Filial atribuída" : "Filiais filtradas") : "Todas as filiais"}
          </span>
        </div>
      </div>

      <div className={layoutStyles.heroCards}>
        <section className={layoutStyles.card}>
          <header className={`${layoutStyles.cardHeader} ${styles.centeredCardHeader}`}>
            <div>
              <p className={layoutStyles.cardEyebrow}>Calendário</p>
              <h2>Agendamentos marcados</h2>
            </div>
          </header>
          <div className={styles.calendarGrid} role="grid" aria-label="Calendário de agendamentos">
            {calendarDays.map((day) => (
              <div
                key={day.key}
                className={`${styles.calendarDay} ${calendarStateClasses[day.state]} ${day.outOfMonth ? styles.calendarDayMuted : ""} ${
                  selectedDate && isSameDay(day.date, selectedDate) ? styles.calendarDaySelected : ""
                }`}
                aria-label={`Dia ${format(day.date, "dd/MM", { locale: ptBR })} ${CALENDAR_STATE_LABELS[day.state]}`}
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
              </div>
            ))}
          </div>
          <div className={styles.calendarLegend} aria-label="Legenda de cores do calendário">
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendAvailable}`} aria-hidden />
              Livre
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendPartial}`} aria-hidden />
              Parcial
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendFull}`} aria-hidden />
              Lotado
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendPast}`} aria-hidden />
              Passado
            </span>
          </div>
          <div className={styles.calendarControlsRow}>
            <div className={styles.calendarControls}>
              <button type="button" className={styles.pillButton} onClick={() => setVisibleMonth((prev) => addMonths(prev, -1))}>
                ◀
              </button>
              <span className={styles.calendarLabel}>{format(visibleMonth, "LLLL yyyy", { locale: ptBR })}</span>
              <button type="button" className={styles.pillButton} onClick={() => setVisibleMonth((prev) => addMonths(prev, 1))}>
                ▶
              </button>
            </div>
          </div>
        </section>

        <section className={`${layoutStyles.card} ${layoutStyles.feedCard}`}>
          <header className={`${layoutStyles.cardHeader} ${styles.centeredCardHeader}`}>
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
          <div className={styles.tableFilters} ref={filterMenuRef}>
            <button
              type="button"
              className={styles.filterButton}
              aria-haspopup="listbox"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((prev) => !prev)}
            >
              Filtrar
              <span className={styles.filterLabel}>{selectedFilterLabel}</span>
            </button>
            {filterOpen ? (
              <div className={styles.filterMenu} role="listbox" aria-label="Filtros de agendamentos">
                {FILTER_OPTIONS.map((option) => {
                  const isActive = option.key === selectedFilter;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`${styles.filterOption} ${isActive ? styles.filterOptionActive : ""}`}
                      onClick={() => {
                        setSelectedFilter(option.key);
                        setFilterOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </header>
        <div className={layoutStyles.tableWrapper}>
          <table className={layoutStyles.table}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Status</th>
                <th>Serviço</th>
                <th>Técnica</th>
                <th>Data</th>
                <th>Horário</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className={layoutStyles.mutedCell}>
                    Nenhum agendamento para o filtro selecionado.
                  </td>
                </tr>
              ) : null}
              {filteredAppointments.map((appt) => (
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
                  <td className={layoutStyles.valueCell}>{formatStatusLabel(appt.status)}</td>
                  <td className={layoutStyles.mutedCell}>{appt.serviceName}</td>
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
          <header className={`${layoutStyles.cardHeader} ${styles.centeredCardHeader}`}>
            <div>
              <p className={layoutStyles.cardEyebrow}>Métricas</p>
              <h2>Visão geral por período</h2>
            </div>
          </header>

          <div className={styles.metricsCardsGrid}>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Agendamentos</p>
              <p className={styles.metricValue}>{activeAppointments.length}</p>
              <p className={styles.metricHint}>Aguardando finalização</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Confirmados</p>
              <p className={styles.metricValue}>{confirmedAppointments.length}</p>
              <p className={styles.metricHint}>Reservados ou confirmados</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Pendentes</p>
              <p className={styles.metricValue}>{pendingAppointments.length}</p>
              <p className={styles.metricHint}>Aguardando confirmação</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Cancelados</p>
              <p className={styles.metricValue}>{canceledAppointments.length}</p>
              <p className={styles.metricHint}>Cancelados no período</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Reembolsados</p>
              <p className={styles.metricValue}>{refundedAppointments.length}</p>
              <p className={styles.metricHint}>Marcados como reembolsados</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Concluídos</p>
              <p className={styles.metricValue}>{completedAppointments.length}</p>
              <p className={styles.metricHint}>Finalizados no período</p>
            </div>
          </div>
        </section>

        <section className={layoutStyles.card}>
          <header className={`${layoutStyles.cardHeader} ${styles.centeredCardHeader}`}>
            <div>
              <p className={layoutStyles.cardEyebrow}>Distribuição mensal</p>
              <h2>Agendamentos por mês</h2>
            </div>
          </header>

          <div className={styles.monthlyCardBody}>
            <div className={styles.metricsSwitcherRow}>
              <div className={styles.pillSwitcher} role="group" aria-label="Período das métricas">
                <button
                  type="button"
                  className={`${styles.pillButton} ${metricsRange === "7d" ? styles.pillButtonActive : ""}`}
                  onClick={() => setMetricsRange("7d")}
                >
                  7D
                </button>
                <button
                  type="button"
                  className={`${styles.pillButton} ${metricsRange === "30d" ? styles.pillButtonActive : ""}`}
                  onClick={() => setMetricsRange("30d")}
                >
                  30D
                </button>
                <button
                  type="button"
                  className={`${styles.pillButton} ${metricsRange === "60d" ? styles.pillButtonActive : ""}`}
                  onClick={() => setMetricsRange("60d")}
                >
                  60D
                </button>
                <button
                  type="button"
                  className={`${styles.pillButton} ${metricsRange === "90d" ? styles.pillButtonActive : ""}`}
                  onClick={() => setMetricsRange("90d")}
                >
                  90D
                </button>
                <button
                  type="button"
                  className={`${styles.pillButton} ${metricsRange === "year" ? styles.pillButtonActive : ""}`}
                  onClick={() => setMetricsRange("year")}
                >
                  1A
                </button>
                <button
                  type="button"
                  className={`${styles.pillButton} ${metricsRange === "all" ? styles.pillButtonActive : ""}`}
                  onClick={() => setMetricsRange("all")}
                >
                  total
                </button>
                <button
                  type="button"
                  className={`${styles.pillButton} ${metricsRange === "custom" ? styles.pillButtonActive : ""}`}
                  onClick={() => setMetricsRange("custom")}
                  title="Personalizado"
                >
                  P
                </button>
              </div>
              {metricsRange === "custom" ? (
                <div className={styles.customRangeInputs} aria-label="Período personalizado">
                  <label className={styles.customRangeLabel}>
                    De
                    <input
                      type="date"
                      className={styles.customRangeInput}
                      value={customRange.start}
                      onChange={(event) => setCustomRange((prev) => ({ ...prev, start: event.target.value }))}
                    />
                  </label>
                  <label className={styles.customRangeLabel}>
                    Até
                    <input
                      type="date"
                      className={styles.customRangeInput}
                      value={customRange.end}
                      onChange={(event) => setCustomRange((prev) => ({ ...prev, end: event.target.value }))}
                    />
                  </label>
                </div>
              ) : null}
            </div>
            {distributionTotal > 0 ? (
              <div className={styles.pieChartWrapper} role="img" aria-label="Distribuição das métricas do período">
                <div className={styles.pieChart} style={{ background: pieBackground }} />
                <div className={styles.pieLegend}>
                  {distributionBreakdown.map((item) => (
                    <div key={item.key} className={styles.pieLegendItem}>
                      <span className={styles.pieLegendDot} style={{ background: item.color }} aria-hidden />
                      <span className={styles.pieLegendLabel}>{item.label}</span>
                      <span className={styles.pieLegendValue}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className={styles.emptyState}>Sem dados suficientes para o período selecionado.</p>
            )}
            <div className={styles.distributionFooter} ref={distributionFilterRef}>
              <button
                type="button"
                className={styles.filterButton}
                aria-haspopup="listbox"
                aria-expanded={distributionFilterOpen}
                onClick={() =>
                  setDistributionFilterOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      setDistributionMenu("root");
                    }
                    return next;
                  })
                }
              >
                Filtrar
                <span className={styles.filterLabel}>{distributionFilterLabel}</span>
              </button>
              {distributionFilterOpen ? (
                <div className={`${styles.filterMenu} ${styles.distributionFilterMenu}`} role="listbox" aria-label="Filtros de distribuição">
                  {distributionMenu === "root" ? (
                    <>
                      {[
                        { key: "total", label: "Total" },
                        { key: "services", label: "Serviços" },
                        { key: "techniques", label: "Técnicas" },
                      ].map((option) => {
                        const isActive = option.key === distributionFilter;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            className={`${styles.filterOption} ${isActive ? styles.filterOptionActive : ""}`}
                            onClick={() => {
                              if (option.key === "total") {
                                setDistributionFilter("total");
                                setDistributionFilterOpen(false);
                                return;
                              }
                              if (option.key === "services") {
                                setDistributionFilter("services");
                                setSelectedDistributionService(null);
                                setSelectedDistributionTechnique(null);
                                setDistributionMenu("services");
                                return;
                              }
                              setDistributionFilter("techniques");
                              setSelectedDistributionService(null);
                              setSelectedDistributionTechnique(null);
                              setDistributionMenu("techniques");
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </>
                  ) : distributionMenu === "services" ? (
                    <>
                      {distributionServices.length > 0 ? (
                        distributionServices.map((service) => {
                          const isActive = distributionFilter === "services" && service === selectedDistributionService;
                          return (
                            <button
                              key={service}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              className={`${styles.filterOption} ${isActive ? styles.filterOptionActive : ""}`}
                              onClick={() => {
                                setDistributionFilter("services");
                                setSelectedDistributionService(service);
                                setDistributionFilterOpen(false);
                                setDistributionMenu("root");
                              }}
                            >
                              {service}
                            </button>
                          );
                        })
                      ) : (
                        <span className={styles.filterEmpty}>Sem serviços cadastrados.</span>
                      )}
                      <button
                        type="button"
                        className={styles.filterOption}
                        onClick={() => setDistributionMenu("root")}
                      >
                        Voltar
                      </button>
                    </>
                  ) : (
                    <>
                      {distributionTechniques.length > 0 ? (
                        distributionTechniques.map((technique) => {
                          const isActive = distributionFilter === "techniques" && technique === selectedDistributionTechnique;
                          return (
                            <button
                              key={technique}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              className={`${styles.filterOption} ${isActive ? styles.filterOptionActive : ""}`}
                              onClick={() => {
                                setDistributionFilter("techniques");
                                setSelectedDistributionTechnique(technique);
                                setDistributionFilterOpen(false);
                                setDistributionMenu("root");
                              }}
                            >
                              {technique}
                            </button>
                          );
                        })
                      ) : (
                        <span className={styles.filterEmpty}>Sem técnicas cadastradas.</span>
                      )}
                      <button
                        type="button"
                        className={styles.filterOption}
                        onClick={() => setDistributionMenu("root")}
                      >
                        Voltar
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
      {error ? <div className={layoutStyles.error}>{error}</div> : null}
      {loading ? <div className={layoutStyles.loading}>Carregando agendamentos…</div> : null}
    </div>
  );
}
