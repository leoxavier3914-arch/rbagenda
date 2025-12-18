"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";

import { supabase } from "@/lib/db";

import { useAdminGuard, type AdminRole } from "../../useAdminGuard";
import styles from "./filiais.module.css";

type BranchStatus = "ativa" | "pausada";

type BranchRole = "admin" | "adminsuper" | "adminmaster";

type BranchMember = {
  id: string;
  name: string;
  role: BranchRole;
  isOwner?: boolean;
};

type BranchMetrics = {
  activeMembers: number;
  admins: number;
  supers: number;
  masters: number;
  staff: number;
  appointmentsThisMonth: number;
  occupancy: number;
  growth: number;
};

type Branch = {
  id: string;
  name: string;
  region: string | null;
  focus: string | null;
  status: BranchStatus;
  createdBy: string | null;
  createdByName: string;
  assignedAdmins: BranchMember[];
  staffSlots: number;
  metrics: BranchMetrics;
  chart: { label: string; scheduled: number; active: number }[];
  timezone: string | null;
};

type BranchRow = {
  id: string;
  name: string;
  timezone: string | null;
  owner_id: string | null;
  region: string | null;
  focus: string | null;
  status: BranchStatus | null;
  staff_slots: number | null;
  created_at: string | null;
};

type BranchAdminRow = {
  branch_id: string;
  user_id: string;
  assigned_by: string | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AdminRole | "client" | null;
};

type AppointmentRow = {
  id: string;
  branch_id: string | null;
  status: string | null;
  starts_at: string | null;
};

type StaffRow = {
  branch_id: string | null;
};

const WEEK_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const defaultBranchForm = {
  name: "",
  region: "",
  focus: "",
  staffSlots: 4,
  status: "ativa" as BranchStatus,
};

const normalizeRole = (rawRole: string | null | undefined): BranchRole => {
  if (rawRole === "adminmaster") return "adminmaster";
  if (rawRole === "adminsuper") return "adminsuper";
  return "admin";
};

const resolveDisplayName = (profile?: ProfileRow | null, fallback?: string | null) => {
  if (!profile) return fallback ?? "Usuário";
  if (profile.full_name && profile.full_name.trim().length > 0) return profile.full_name.trim();
  if (profile.email && profile.email.trim().length > 0) return profile.email.trim();
  return fallback ?? "Usuário";
};

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isActiveAppointment = (status: string | null | undefined) => {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return normalized === "confirmed" || normalized === "completed" || normalized === "reserved";
};

const summarizeMembers = (members: BranchMember[], staffCount: number, staffSlots: number): BranchMetrics => {
  const admins = members.filter((member) => member.role === "admin").length;
  const supers = members.filter((member) => member.role === "adminsuper").length;
  const masters = members.filter((member) => member.role === "adminmaster").length;
  const staff = Math.max(staffSlots, staffCount);

  return {
    activeMembers: admins + supers + masters + staff,
    admins,
    supers,
    masters,
    staff,
    appointmentsThisMonth: 0,
    occupancy: staff > 0 ? Math.min(100, Math.round(((admins + supers + masters + staff) / staff) * 25)) : 0,
    growth: 0,
  };
};

const calculateGrowth = (previous: number, current: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const buildChart = (appointments: AppointmentRow[]) => {
  const grid = WEEK_LABELS.map((label) => ({ label, scheduled: 0, active: 0 }));

  for (const appointment of appointments) {
    const date = parseDate(appointment.starts_at);
    if (!date) continue;
    const weekday = date.getDay();
    if (weekday === 0) continue; // ignora domingo para manter a grade enxuta
    const index = weekday - 1;
    const current = grid[index];
    current.scheduled += 1;
    if (isActiveAppointment(appointment.status)) {
      current.active += 1;
    }
  }

  return grid;
};

export default function FiliaisPage() {
  const { status, role } = useAdminGuard({
    allowedRoles: ["adminsuper", "adminmaster"],
    fallbackRedirects: { admin: "/admin", client: "/meu-perfil", unauthenticated: "/login" },
  });

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [newBranch, setNewBranch] = useState(defaultBranchForm);
  const [newMemberId, setNewMemberId] = useState<string>("");
  const [availableAdmins, setAvailableAdmins] = useState<BranchMember[]>([]);
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminOptions = useCallback(async (): Promise<BranchMember[]> => {
    const { data, error: optionsError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["admin", "adminsuper", "adminmaster"])
      .order("full_name", { ascending: true })
      .returns<ProfileRow[]>();

    if (optionsError) {
      console.error("Erro ao buscar administradores disponíveis", optionsError);
      return [];
    }

    return (
      data?.map((profile) => ({
        id: profile.id,
        name: resolveDisplayName(profile, profile.email),
        role: normalizeRole(profile.role),
      })) ?? []
    );
  }, []);

  const fetchBranches = useCallback(
    async (currentUserId: string, currentRole: AdminRole | "client" | null) => {
      const isMaster = currentRole === "adminmaster";
      const branchSelection = () =>
        supabase
          .from("branches")
          .select("id, name, timezone, owner_id, region, focus, status, staff_slots, created_at")
          .returns<BranchRow[]>();

      const branchAssignments = isMaster
        ? []
        : (
            await supabase
              .from("branch_admins")
              .select("branch_id")
              .eq("user_id", currentUserId)
              .returns<Pick<BranchAdminRow, "branch_id">[]>()
          ).data ?? [];

      let branchRows: BranchRow[] = [];
      if (isMaster) {
        const { data, error: branchesError } = await branchSelection().order("created_at", { ascending: false });
        if (branchesError) throw branchesError;
        branchRows = data ?? [];
      } else {
        const assignmentIds = [...new Set(branchAssignments.map((assignment) => assignment.branch_id))];

        const [{ data: ownedBranches, error: ownedError }, assignedResult] = await Promise.all([
          branchSelection().eq("owner_id", currentUserId).order("created_at", { ascending: false }),
          assignmentIds.length > 0
            ? supabase
                .from("branches")
                .select("id, name, timezone, owner_id, region, focus, status, staff_slots, created_at")
                .in("id", assignmentIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (ownedError) throw ownedError;
        if (assignedResult.error) throw assignedResult.error;

        const dedup = new Map<string, BranchRow>();
        (ownedBranches ?? []).forEach((branch) => dedup.set(branch.id, branch));
        (assignedResult.data ?? []).forEach((branch) => dedup.set(branch.id, branch));
        branchRows = Array.from(dedup.values()).sort((a, b) => (a.created_at && b.created_at ? (a.created_at > b.created_at ? -1 : 1) : 0));
      }

      const branchIds = branchRows.map((branch) => branch.id);
      if (!branchIds.length) return [];

      const [adminsResult, staffResult] = await Promise.all([
        supabase
          .from("branch_admins")
          .select("branch_id, user_id, assigned_by, created_at")
          .in("branch_id", branchIds)
          .returns<BranchAdminRow[]>(),
        supabase.from("staff").select("branch_id").in("branch_id", branchIds).returns<StaffRow[]>(),
      ]);

      if (adminsResult.error) throw adminsResult.error;
      if (staffResult.error) throw staffResult.error;

      const now = new Date();
      const currentMonthStart = startOfMonth(now);
      const previousMonthStart = startOfMonth(subMonths(now, 1));
      const currentMonthEnd = endOfMonth(now);

      const { data: appointmentRows, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id, branch_id, status, starts_at")
        .in("branch_id", branchIds)
        .gte("starts_at", previousMonthStart.toISOString())
        .lte("starts_at", currentMonthEnd.toISOString())
        .returns<AppointmentRow[]>();

      if (appointmentsError) throw appointmentsError;

      const branchAdminsByBranch = new Map<string, BranchAdminRow[]>();
      for (const assignment of adminsResult.data ?? []) {
        const list = branchAdminsByBranch.get(assignment.branch_id) ?? [];
        list.push(assignment);
        branchAdminsByBranch.set(assignment.branch_id, list);
      }

      const staffCountByBranch = new Map<string, number>();
      for (const staff of staffResult.data ?? []) {
        if (!staff.branch_id) continue;
        staffCountByBranch.set(staff.branch_id, (staffCountByBranch.get(staff.branch_id) ?? 0) + 1);
      }

      const appointmentsByBranch = new Map<string, AppointmentRow[]>();
      for (const appointment of appointmentRows ?? []) {
        if (!appointment.branch_id) continue;
        const list = appointmentsByBranch.get(appointment.branch_id) ?? [];
        list.push(appointment);
        appointmentsByBranch.set(appointment.branch_id, list);
      }

      const profileIds = new Set<string>();
      branchRows.forEach((branch) => {
        if (branch.owner_id) profileIds.add(branch.owner_id);
      });
      (adminsResult.data ?? []).forEach((assignment) => profileIds.add(assignment.user_id));
      (adminsResult.data ?? []).forEach((assignment) => assignment.assigned_by && profileIds.add(assignment.assigned_by));

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", Array.from(profileIds))
        .returns<ProfileRow[]>();

      if (profilesError) throw profilesError;

      const profileMap = new Map<string, ProfileRow>();
      for (const profile of profiles ?? []) {
        profileMap.set(profile.id, profile);
      }

      return branchRows.map<Branch>((branch) => {
        const ownerProfile = branch.owner_id ? profileMap.get(branch.owner_id) ?? null : null;
        const ownerMember = branch.owner_id
          ? {
              id: branch.owner_id,
              name: resolveDisplayName(ownerProfile, null),
              role: normalizeRole(ownerProfile?.role ?? "admin"),
              isOwner: true,
            }
          : null;

        const assignmentMembers: BranchMember[] = (branchAdminsByBranch.get(branch.id) ?? [])
          .map((assignment) => {
            const profile = profileMap.get(assignment.user_id);
            if (!profile) return null;
            return {
              id: assignment.user_id,
              name: resolveDisplayName(profile, profile.email),
              role: normalizeRole(profile.role),
            };
          })
          .filter((member): member is BranchMember => Boolean(member));

        const membersMap = new Map<string, BranchMember>();
        if (ownerMember) membersMap.set(ownerMember.id, ownerMember);
        assignmentMembers.forEach((member) => {
          if (!membersMap.has(member.id)) {
            membersMap.set(member.id, member);
          }
        });

        const members = Array.from(membersMap.values());
        const staffCount = staffCountByBranch.get(branch.id) ?? 0;
        const staffSlots = Math.max(branch.staff_slots ?? 0, staffCount);

        const metrics = summarizeMembers(members, staffCount, staffSlots);
        const branchAppointments = appointmentsByBranch.get(branch.id) ?? [];

        const currentMonthAppointments = branchAppointments.filter((appointment) => {
          const date = parseDate(appointment.starts_at);
          return date && date >= currentMonthStart;
        });

        const previousMonthAppointments = branchAppointments.filter((appointment) => {
          const date = parseDate(appointment.starts_at);
          return date && date >= previousMonthStart && date < currentMonthStart;
        });

        const appointmentsThisMonth = currentMonthAppointments.length;
        const occupancyBase =
          staffSlots > 0 ? Math.round(Math.min(100, Math.max(0, (appointmentsThisMonth / (staffSlots * 20)) * 100))) : 0;

        return {
          id: branch.id,
          name: branch.name,
          region: branch.region,
          focus: branch.focus,
          status: (branch.status ?? "ativa") as BranchStatus,
          createdBy: branch.owner_id,
          createdByName: resolveDisplayName(ownerProfile, "Criador não informado"),
          assignedAdmins: members,
          staffSlots,
          timezone: branch.timezone,
          metrics: {
            ...metrics,
            appointmentsThisMonth,
            growth: calculateGrowth(previousMonthAppointments.length, appointmentsThisMonth),
            occupancy: occupancyBase,
          },
          chart: buildChart(currentMonthAppointments),
        };
      });
    },
    []
  );

  useEffect(() => {
    if (status !== "authorized") return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: userResponse } = await supabase.auth.getUser();
        const authUser = userResponse.user;
        if (!authUser?.id) {
          throw new Error("Usuário não autenticado");
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, role")
          .eq("id", authUser.id)
          .maybeSingle();

        if (!active) return;
        setUserId(authUser.id);

        const [adminOptions, branchList] = await Promise.all([
          fetchAdminOptions(),
          fetchBranches(authUser.id, (profile?.role as AdminRole | "client" | null) ?? role),
        ]);

        if (!active) return;

        setAvailableAdmins(adminOptions);
        setNewMemberId((prev) => prev || adminOptions[0]?.id ?? "");

        setBranches(branchList);
        setSelectedBranchId((current) => {
          if (current && branchList.some((branch) => branch.id === current)) return current;
          return branchList[0]?.id ?? null;
        });
      } catch (err) {
        console.error("Erro ao carregar filiais", err);
        if (!active) return;
        setError("Não foi possível carregar as filiais agora.");
        setBranches([]);
        setSelectedBranchId(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [fetchAdminOptions, fetchBranches, role, status]);

  const refreshBranches = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      const branchList = await fetchBranches(userId, (profile?.role as AdminRole | "client" | null) ?? role);
      setBranches(branchList);
      setSelectedBranchId((current) => {
        if (current && branchList.some((branch) => branch.id === current)) return current;
        return branchList[0]?.id ?? null;
      });
    } catch (err) {
      console.error("Erro ao atualizar filiais", err);
      setError("Não foi possível atualizar as filiais.");
    }
  }, [fetchBranches, role, userId]);

  const handleCreateBranch = async () => {
    if (!userId) {
      setError("Usuário não autenticado para criar filial.");
      return;
    }

    if (!newBranch.name.trim() || !newBranch.region.trim() || !newBranch.focus.trim()) {
      setNote("Preencha todos os campos para criar a filial.");
      return;
    }

    setSaving(true);
    setNote("");
    setError(null);

    try {
      const { error: createError } = await supabase.from("branches").insert({
        name: newBranch.name.trim(),
        owner_id: userId,
        timezone: "America/Sao_Paulo",
        region: newBranch.region.trim(),
        focus: newBranch.focus.trim(),
        status: newBranch.status,
        staff_slots: newBranch.staffSlots,
      });

      if (createError) {
        throw createError;
      }

      await refreshBranches();
      setNewBranch(defaultBranchForm);
      setNote("Filial criada e salva na Supabase.");
    } catch (err) {
      console.error("Erro ao criar filial", err);
      setError("Não foi possível criar a filial agora.");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkMember = async (branchId: string) => {
    if (!branchId || !newMemberId) return;
    setSaving(true);
    setError(null);
    setNote("");

    try {
      const { error: linkError } = await supabase.from("branch_admins").insert({
        branch_id: branchId,
        user_id: newMemberId,
        assigned_by: userId,
      });

      if (linkError && linkError.code !== "23505") {
        throw linkError;
      }

      await refreshBranches();
      setNote("Administrador vinculado.");
    } catch (err) {
      console.error("Erro ao vincular administrador", err);
      setError("Não foi possível vincular o administrador.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkMember = async (branchId: string, memberId: string) => {
    setSaving(true);
    setError(null);
    setNote("");

    try {
      const { error: unlinkError } = await supabase
        .from("branch_admins")
        .delete()
        .eq("branch_id", branchId)
        .eq("user_id", memberId);

      if (unlinkError) {
        throw unlinkError;
      }

      await refreshBranches();
      setNote("Administrador desvinculado.");
    } catch (err) {
      console.error("Erro ao desvincular administrador", err);
      setError("Não foi possível desvincular o administrador.");
    } finally {
      setSaving(false);
    }
  };

  const totalMetrics = useMemo(() => {
    if (!branches.length) return null;

    return branches.reduce(
      (acc, branch) => {
        acc.activeMembers += branch.metrics.activeMembers;
        acc.staff += branch.metrics.staff;
        acc.admins += branch.metrics.admins;
        acc.supers += branch.metrics.supers;
        acc.masters += branch.metrics.masters;
        return acc;
      },
      { activeMembers: 0, staff: 0, admins: 0, supers: 0, masters: 0 }
    );
  }, [branches]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? branches[0] ?? null,
    [branches, selectedBranchId]
  );

  if (status === "checking" || loading) {
    return <div className={styles.page}>Carregando filiais...</div>;
  }

  if (!branches.length) {
    return (
      <div className={styles.page}>
        <div className={styles.headerCard}>
          <p className={styles.sectionEyebrow}>Filiais</p>
          <h1 className={styles.headerTitle}>Sem filiais disponíveis</h1>
          <p className={styles.sectionDescription}>
            Seu perfil ainda não tem filiais atribuídas. Crie ou peça a um Master para vincular filiais existentes.
          </p>
          {error ? <div className={styles.errorMessage}>{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerCard}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.sectionEyebrow}>Filiais</p>
            <h1 className={styles.headerTitle}>Gestão de filiais e acessos</h1>
            <p className={styles.sectionDescription}>
              {role === "adminmaster"
                ? "Master pode visualizar e editar todas as filiais."
                : "Super Admin limitado às filiais criadas por você ou atribuídas por um Master."}
            </p>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.tag}>Nível: {role === "adminmaster" ? "Master" : "Super"}</span>
            <span className={styles.tag}>Filiais visíveis: {branches.length}</span>
          </div>
        </div>
        {totalMetrics ? (
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Membros ativos</p>
              <span className={styles.metricValue}>{totalMetrics.activeMembers}</span>
              <span className={styles.metricDelta}>+{totalMetrics.admins + totalMetrics.supers + totalMetrics.masters} admins e staff</span>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Masters / Supers</p>
              <span className={styles.metricValue}>
                {totalMetrics.masters} / {totalMetrics.supers}
              </span>
              <span className={styles.metricDelta}>Cobertura de liderança</span>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Admins / Staff</p>
              <span className={styles.metricValue}>
                {totalMetrics.admins} / {totalMetrics.staff}
              </span>
              <span className={styles.metricDelta}>Capacidade local</span>
            </div>
          </div>
        ) : null}
        {error ? <div className={styles.errorMessage}>{error}</div> : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Criar filial</p>
          <h2 className={styles.sectionTitle}>Nova filial vinculada ao seu usuário</h2>
          <p className={styles.sectionDescription}>
            Super Admin só cria filiais próprias; Master pode criar para qualquer grupo. Salve para depois vincular mais pessoas.
          </p>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Nome</span>
            <input
              value={newBranch.name}
              onChange={(event) => setNewBranch((prev) => ({ ...prev, name: event.target.value }))}
              className={styles.inputControl}
              placeholder="Ex.: Studio Centro"
              disabled={saving}
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Região</span>
            <input
              value={newBranch.region}
              onChange={(event) => setNewBranch((prev) => ({ ...prev, region: event.target.value }))}
              className={styles.inputControl}
              placeholder="Cidade / Bairro"
              disabled={saving}
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Status</span>
            <select
              value={newBranch.status}
              onChange={(event) => setNewBranch((prev) => ({ ...prev, status: event.target.value as BranchStatus }))}
              className={styles.selectControl}
              disabled={saving}
            >
              <option value="ativa">Ativa</option>
              <option value="pausada">Pausada</option>
            </select>
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Staff previsto</span>
            <input
              type="number"
              min={0}
              value={newBranch.staffSlots}
              onChange={(event) =>
                setNewBranch((prev) => ({
                  ...prev,
                  staffSlots: Math.max(0, Number(event.target.value) || 0),
                }))
              }
              className={styles.inputControl}
              disabled={saving}
            />
            <span className={styles.helperText}>Staff influencia a contagem de membros ativos.</span>
          </label>
        </div>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Foco</span>
          <textarea
            value={newBranch.focus}
            onChange={(event) => setNewBranch((prev) => ({ ...prev, focus: event.target.value }))}
            className={styles.textareaControl}
            placeholder="Objetivo dessa filial (expansão, treinamento, campanha, etc.)"
            disabled={saving}
          />
        </label>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.primaryButton} onClick={handleCreateBranch} disabled={saving}>
            {saving ? "Salvando..." : "Criar filial"}
          </button>
          {note ? <span className={styles.helperText}>{note}</span> : null}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Filiais disponíveis</p>
          <h2 className={styles.sectionTitle}>Gerenciar membros ativos</h2>
          <p className={styles.sectionDescription}>
            Vincule ou desvincule administradores. Super Admin só enxerga as filiais que criou ou que um Master vinculou.
          </p>
        </div>
        <div className={styles.buttonRow}>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Selecionar filial</span>
            <select
              className={styles.selectControl}
              value={selectedBranchId ?? undefined}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              disabled={saving}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Vincular administrador</span>
            <select
              className={styles.selectControl}
              value={newMemberId}
              onChange={(event) => setNewMemberId(event.target.value)}
              disabled={saving}
            >
              {availableAdmins.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} — {member.role}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => selectedBranchId && handleLinkMember(selectedBranchId)}
              disabled={saving || !selectedBranchId}
            >
              Vincular ao time
            </button>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Filial</th>
                <th>Região</th>
                <th>Status</th>
                <th>Membros ativos</th>
                <th>Admins vinculados</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id}>
                  <td>
                    <div className={styles.sectionTitle}>{branch.name}</div>
                    <p className={styles.sectionDescription}>{branch.focus || "Sem foco cadastrado"}</p>
                  </td>
                  <td>
                    <span className={styles.badgeNeutral}>{branch.region || "Sem região"}</span>
                  </td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        branch.status === "ativa" ? styles.statusActive : styles.statusPaused
                      }`}
                    >
                      {branch.status === "ativa" ? "Ativa" : "Pausada"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.pillGroup}>
                      <span className={styles.memberPill}>
                        <span className={styles.memberRole}>Masters</span>
                        {branch.metrics.masters}
                      </span>
                      <span className={styles.memberPill}>
                        <span className={styles.memberRole}>Supers</span>
                        {branch.metrics.supers}
                      </span>
                      <span className={styles.memberPill}>
                        <span className={styles.memberRole}>Admins</span>
                        {branch.metrics.admins}
                      </span>
                      <span className={styles.memberPill}>
                        <span className={styles.memberRole}>Staff</span>
                        {branch.metrics.staff}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.pillGroup}>
                      {branch.assignedAdmins.map((member) => (
                        <span key={member.id} className={styles.memberPill}>
                          {member.name}
                          <span className={styles.memberRole}>{member.role}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={styles.actionsCell}>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => handleLinkMember(branch.id)}
                      disabled={saving}
                    >
                      Vincular
                    </button>
                    {branch.assignedAdmins
                      .filter((member) => member.id !== userId || role === "adminmaster")
                      .map((member) => (
                        <button
                          key={`${branch.id}-${member.id}`}
                          type="button"
                          className={styles.dangerButton}
                          onClick={() => handleUnlinkMember(branch.id, member.id)}
                          disabled={saving}
                        >
                          Desvincular {member.name}
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBranch ? (
        <div className={styles.section}>
          <div className={styles.chartHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Métricas da filial</p>
              <h2 className={styles.sectionTitle}>{selectedBranch.name}</h2>
              <p className={styles.sectionDescription}>
                Criador: {selectedBranch.createdByName}. Membros ativos consideram staff cadastrado no Supabase.
              </p>
            </div>
            <div className={styles.inlineFilters}>
              <span className={styles.badgeNeutral}>Membros ativos: {selectedBranch.metrics.activeMembers}</span>
              <span className={styles.badgeNeutral}>Ocupação estimada: {selectedBranch.metrics.occupancy}%</span>
              <span className={styles.badgeNeutral}>Agendamentos no mês: {selectedBranch.metrics.appointmentsThisMonth}</span>
            </div>
          </div>
          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatchPrimary} /> Agendados
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatchSecondary} /> Ativos
            </div>
          </div>
          <div className={styles.chart}>
            {selectedBranch.chart.map((item) => (
              <div key={item.label} className={styles.chartColumn}>
                <div className={styles.chartBar} style={{ height: `${Math.max(item.scheduled, 1) * 4}px` }}>
                  <span>{item.scheduled}</span>
                  <span className={styles.chartLabel}>{item.label}</span>
                </div>
                <div
                  className={`${styles.chartBar} ${styles.chartBarSecondary}`}
                  style={{ height: `${Math.max(item.active, 1) * 4}px` }}
                >
                  <span>{item.active}</span>
                  <span className={styles.chartLabel}>Ativos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>Selecione uma filial para visualizar o gráfico.</div>
      )}
    </div>
  );
}
