"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";

import { useAdminGuard } from "../../useAdminGuard";
import styles from "./filiais.module.css";

type BranchRole = "admin" | "adminsuper" | "adminmaster" | "staff";

type BranchMember = {
  id: string;
  name: string;
  role: BranchRole;
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
  region: string;
  focus: string;
  status: "ativa" | "pausada";
  createdBy: string;
  createdByName: string;
  assignedAdmins: BranchMember[];
  staffSlots: number;
  metrics: BranchMetrics;
  chart: { label: string; scheduled: number; active: number }[];
};

const availableAdmins: BranchMember[] = [
  { id: "master-1", name: "Master Admin", role: "adminmaster" },
  { id: "super-1", name: "Laura Super", role: "adminsuper" },
  { id: "super-2", name: "Diego Super", role: "adminsuper" },
  { id: "adm-1", name: "Rafa Adm", role: "admin" },
  { id: "staff-1", name: "Equipe Studio", role: "staff" },
];

const initialBranches: Branch[] = [
  {
    id: "sp-01",
    name: "Studio Paulista",
    region: "São Paulo / Av. Paulista",
    focus: "Alongamento, coloração e pós-procedimento",
    status: "ativa",
    createdBy: "master-1",
    createdByName: "Master Admin",
    assignedAdmins: [
      { id: "master-1", name: "Master Admin", role: "adminmaster" },
      { id: "super-1", name: "Laura Super", role: "adminsuper" },
      { id: "adm-1", name: "Rafa Adm", role: "admin" },
    ],
    staffSlots: 6,
    metrics: {
      activeMembers: 9,
      admins: 1,
      supers: 1,
      masters: 1,
      staff: 6,
      appointmentsThisMonth: 132,
      occupancy: 86,
      growth: 12,
    },
    chart: [
      { label: "Seg", scheduled: 18, active: 12 },
      { label: "Ter", scheduled: 21, active: 15 },
      { label: "Qua", scheduled: 17, active: 13 },
      { label: "Qui", scheduled: 19, active: 14 },
      { label: "Sex", scheduled: 23, active: 16 },
      { label: "Sáb", scheduled: 25, active: 18 },
    ],
  },
  {
    id: "sp-02",
    name: "Zona Norte",
    region: "São Paulo / Santana",
    focus: "Expansão e campanhas locais",
    status: "ativa",
    createdBy: "super-2",
    createdByName: "Diego Super",
    assignedAdmins: [
      { id: "super-2", name: "Diego Super", role: "adminsuper" },
    ],
    staffSlots: 3,
    metrics: {
      activeMembers: 4,
      admins: 0,
      supers: 1,
      masters: 0,
      staff: 3,
      appointmentsThisMonth: 68,
      occupancy: 63,
      growth: 8,
    },
    chart: [
      { label: "Seg", scheduled: 10, active: 6 },
      { label: "Ter", scheduled: 8, active: 6 },
      { label: "Qua", scheduled: 11, active: 7 },
      { label: "Qui", scheduled: 9, active: 6 },
      { label: "Sex", scheduled: 12, active: 8 },
      { label: "Sáb", scheduled: 13, active: 9 },
    ],
  },
  {
    id: "rj-01",
    name: "Rio Downtown",
    region: "Rio de Janeiro / Centro",
    focus: "Treinamento de staff e novas técnicas",
    status: "pausada",
    createdBy: "super-1",
    createdByName: "Laura Super",
    assignedAdmins: [
      { id: "super-1", name: "Laura Super", role: "adminsuper" },
    ],
    staffSlots: 2,
    metrics: {
      activeMembers: 3,
      admins: 0,
      supers: 1,
      masters: 0,
      staff: 2,
      appointmentsThisMonth: 21,
      occupancy: 34,
      growth: -4,
    },
    chart: [
      { label: "Seg", scheduled: 3, active: 1 },
      { label: "Ter", scheduled: 4, active: 2 },
      { label: "Qua", scheduled: 6, active: 2 },
      { label: "Qui", scheduled: 4, active: 2 },
      { label: "Sex", scheduled: 2, active: 1 },
      { label: "Sáb", scheduled: 2, active: 1 },
    ],
  },
];

function summarizeMembers(members: BranchMember[], staffSlots: number): BranchMetrics {
  const admins = members.filter((member) => member.role === "admin").length;
  const supers = members.filter((member) => member.role === "adminsuper").length;
  const masters = members.filter((member) => member.role === "adminmaster").length;
  const staff = members.filter((member) => member.role === "staff").length || staffSlots;

  return {
    activeMembers: admins + supers + masters + staff,
    admins,
    supers,
    masters,
    staff,
    appointmentsThisMonth: 32,
    occupancy: 48,
    growth: 6,
  };
}

export default function FiliaisPage() {
  const { status, role } = useAdminGuard({
    allowedRoles: ["adminsuper", "adminmaster"],
    fallbackRedirects: { admin: "/admin", client: "/meu-perfil", unauthenticated: "/login" },
  });

  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(initialBranches[0]?.id ?? null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Você");
  const [newBranch, setNewBranch] = useState({
    name: "",
    region: "",
    focus: "",
    staffSlots: 4,
    status: "ativa" as Branch["status"],
  });
  const [newMemberId, setNewMemberId] = useState<string>(availableAdmins[0]?.id ?? "");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user?.id) {
        setUserId(data.user.id);
        setUserName(data.user.user_metadata?.full_name ?? data.user.email ?? "Você");
      }
    };

    void loadUser();
    return () => {
      active = false;
    };
  }, []);

  const accessibleBranches = useMemo(() => {
    if (role === "adminmaster") return branches;
    if (!userId) return [];
    return branches.filter(
      (branch) => branch.createdBy === userId || branch.assignedAdmins.some((member) => member.id === userId)
    );
  }, [branches, role, userId]);

  useEffect(() => {
    if (!accessibleBranches.length) {
      setSelectedBranchId(null);
      return;
    }

    if (!selectedBranchId || !accessibleBranches.find((branch) => branch.id === selectedBranchId)) {
      setSelectedBranchId(accessibleBranches[0]?.id ?? null);
    }
  }, [accessibleBranches, selectedBranchId]);

  const selectedBranch = useMemo(
    () => accessibleBranches.find((branch) => branch.id === selectedBranchId) ?? accessibleBranches[0] ?? null,
    [accessibleBranches, selectedBranchId]
  );

  const handleCreateBranch = () => {
    if (!newBranch.name || !newBranch.region || !newBranch.focus || !userId) return;

    const creator: BranchMember = {
      id: userId,
      name: userName,
      role: (role ?? "adminsuper") as BranchRole,
    };

    const members = [creator];
    const metrics = summarizeMembers(members, newBranch.staffSlots);
    const baseChart = [
      { label: "Seg", scheduled: 4, active: 2 },
      { label: "Ter", scheduled: 5, active: 3 },
      { label: "Qua", scheduled: 6, active: 3 },
      { label: "Qui", scheduled: 7, active: 4 },
      { label: "Sex", scheduled: 8, active: 5 },
      { label: "Sáb", scheduled: 6, active: 4 },
    ];

    const newEntry: Branch = {
      id: `branch-${Date.now()}`,
      name: newBranch.name,
      region: newBranch.region,
      focus: newBranch.focus,
      status: newBranch.status,
      createdBy: creator.id,
      createdByName: creator.name,
      assignedAdmins: members,
      staffSlots: newBranch.staffSlots,
      metrics: { ...metrics, appointmentsThisMonth: 24 + metrics.staff * 2 },
      chart: baseChart,
    };

    setBranches((previous) => [newEntry, ...previous]);
    setSelectedBranchId(newEntry.id);
    setNewBranch({ name: "", region: "", focus: "", staffSlots: 4, status: "ativa" });
    setNote("Filial criada localmente. Conecte a persistência quando a tabela de filiais estiver pronta.");
  };

  const handleLinkMember = (branchId: string) => {
    const member = availableAdmins.find((item) => item.id === newMemberId);
    if (!member) return;

    setBranches((previous) =>
      previous.map((branch) => {
        if (branch.id !== branchId) return branch;
        if (branch.assignedAdmins.some((item) => item.id === member.id)) return branch;

        const assignedAdmins = [...branch.assignedAdmins, member];
        return {
          ...branch,
          assignedAdmins,
          metrics: {
            ...branch.metrics,
            ...summarizeMembers(assignedAdmins, branch.staffSlots),
          },
        };
      })
    );
  };

  const handleUnlinkMember = (branchId: string, memberId: string) => {
    setBranches((previous) =>
      previous.map((branch) => {
        if (branch.id !== branchId) return branch;
        const assignedAdmins = branch.assignedAdmins.filter((member) => member.id !== memberId);
        return {
          ...branch,
          assignedAdmins,
          metrics: {
            ...branch.metrics,
            ...summarizeMembers(assignedAdmins, branch.staffSlots),
          },
        };
      })
    );
  };

  const totalMetrics = useMemo(() => {
    const source = accessibleBranches;
    if (!source.length) return null;

    const accumulator = source.reduce(
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

    return accumulator;
  }, [accessibleBranches]);

  if (status === "checking") {
    return <div className={styles.page}>Carregando acesso...</div>;
  }

  if (!accessibleBranches.length) {
    return (
      <div className={styles.page}>
        <div className={styles.headerCard}>
          <p className={styles.sectionEyebrow}>Filiais</p>
          <h1 className={styles.headerTitle}>Sem filiais disponíveis</h1>
          <p className={styles.sectionDescription}>
            Seu perfil ainda não tem filiais atribuídas. Filiais precisam ser criadas por você ou vinculadas por um Master.
          </p>
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
            <span className={styles.tag}>Filiais visíveis: {accessibleBranches.length}</span>
          </div>
        </div>
        {totalMetrics ? (
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Membros ativos</p>
              <span className={styles.metricValue}>{totalMetrics.activeMembers}</span>
              <span className={styles.metricDelta}>+3 vs. semana passada</span>
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
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Região</span>
            <input
              value={newBranch.region}
              onChange={(event) => setNewBranch((prev) => ({ ...prev, region: event.target.value }))}
              className={styles.inputControl}
              placeholder="Cidade / Bairro"
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Status</span>
            <select
              value={newBranch.status}
              onChange={(event) => setNewBranch((prev) => ({ ...prev, status: event.target.value as Branch["status"] }))}
              className={styles.selectControl}
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
                setNewBranch((prev) => ({ ...prev, staffSlots: Number(event.target.value) || prev.staffSlots }))
              }
              className={styles.inputControl}
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
          />
        </label>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.primaryButton} onClick={handleCreateBranch}>
            Criar filial
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
            >
              {accessibleBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Vincular administrador</span>
            <select className={styles.selectControl} value={newMemberId} onChange={(event) => setNewMemberId(event.target.value)}>
              {availableAdmins.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} — {member.role}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.buttonRow}>
            <button type="button" className={styles.secondaryButton} onClick={() => selectedBranchId && handleLinkMember(selectedBranchId)}>
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
              {accessibleBranches.map((branch) => (
                <tr key={branch.id}>
                  <td>
                    <div className={styles.sectionTitle}>{branch.name}</div>
                    <p className={styles.sectionDescription}>{branch.focus}</p>
                  </td>
                  <td>
                    <span className={styles.badgeNeutral}>{branch.region}</span>
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
                    <button type="button" className={styles.linkButton} onClick={() => handleLinkMember(branch.id)}>
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
                Apenas filiais criadas ou atribuídas aparecem aqui para Super Admin. Master vê todas.
              </p>
            </div>
            <div className={styles.inlineFilters}>
              <span className={styles.badgeNeutral}>Criador: {selectedBranch.createdByName}</span>
              <span className={styles.badgeNeutral}>Membros ativos: {selectedBranch.metrics.activeMembers}</span>
              <span className={styles.badgeNeutral}>Ocupação: {selectedBranch.metrics.occupancy}%</span>
            </div>
          </div>
          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatchPrimary} /> Agendados
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatchSecondary} /> Membros ativos
            </div>
          </div>
          <div className={styles.chart}>
            {selectedBranch.chart.map((item) => (
              <div key={item.label} className={styles.chartColumn}>
                <div className={styles.chartBar} style={{ height: `${Math.max(item.scheduled, 4) * 4}px` }}>
                  <span>{item.scheduled}</span>
                  <span className={styles.chartLabel}>{item.label}</span>
                </div>
                <div
                  className={`${styles.chartBar} ${styles.chartBarSecondary}`}
                  style={{ height: `${Math.max(item.active, 2) * 4}px` }}
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
