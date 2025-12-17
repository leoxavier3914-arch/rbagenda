"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/db";
import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";
import { useCurrentUserId } from "@/app/(admin)/@components/useCurrentUserId";

import styles from "../../../adminPanel.module.css";

type Branch = {
  id: string;
  name: string;
  timezone: string;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
};

type BranchAdminAssignment = {
  id: string;
  branch_id: string;
  user_id: string;
  profile: { id: string; full_name: string | null; email: string | null } | null;
};

type SuperProfile = { id: string; full_name: string | null; email: string | null };
type AdminProfile = { id: string; full_name: string | null; email: string | null };

const TIMEZONE_OPTIONS = ["America/Sao_Paulo", "America/Bahia", "America/Recife", "America/Manaus", "America/Fortaleza"];

function MasterBranchesContent() {
  const { userId } = useCurrentUserId();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [supers, setSupers] = useState<SuperProfile[]>([]);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [assignments, setAssignments] = useState<Record<string, BranchAdminAssignment[]>>({});
  const [ownerSelection, setOwnerSelection] = useState<Record<string, string>>({});
  const [adminSelection, setAdminSelection] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, { name: string; timezone: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [branchesResponse, supersResponse, adminsResponse, branchAdminsResponse] = await Promise.all([
        supabase
          .from("branches")
          .select("id, name, timezone, owner_id, created_at, owner:profiles!branches_owner_id_fkey(id, full_name, email)")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "adminsuper")
          .order("full_name", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "admin")
          .order("full_name", { ascending: true }),
        supabase
          .from("branch_admins")
          .select("id, branch_id, user_id, profiles:profiles!branch_admins_user_id_fkey(id, full_name, email)")
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;

      if (branchesResponse.error || supersResponse.error || adminsResponse.error || branchAdminsResponse.error) {
        setError("Não foi possível carregar os dados das filiais.");
        setLoading(false);
        return;
      }

      const normalizedBranches = (branchesResponse.data ?? []).map((branch) => {
        const owner = Array.isArray(branch.owner) ? branch.owner[0] ?? null : branch.owner ?? null;
        return {
          id: branch.id,
          name: branch.name ?? "Filial",
          timezone: branch.timezone ?? TIMEZONE_OPTIONS[0],
          owner_id: branch.owner_id ?? null,
          owner_name: owner?.full_name ?? null,
          created_at: branch.created_at,
        } satisfies Branch;
      });

      const groupedAdmins = (branchAdminsResponse.data ?? []).reduce<Record<string, BranchAdminAssignment[]>>(
        (acc, entry) => {
          const profile = Array.isArray(entry.profiles)
            ? entry.profiles[0]
            : (entry.profiles as BranchAdminAssignment["profile"] | null | undefined);
          const mapped: BranchAdminAssignment = {
            id: entry.id,
            branch_id: entry.branch_id,
            user_id: entry.user_id,
            profile: profile ? { id: profile.id, full_name: profile.full_name ?? null, email: profile.email ?? null } : null,
          };

          const current = acc[entry.branch_id] ?? [];
          return { ...acc, [entry.branch_id]: [...current, mapped] };
        },
        {}
      );

      setBranches(normalizedBranches);
      setSupers((supersResponse.data ?? []) as SuperProfile[]);
      setAdmins((adminsResponse.data ?? []) as AdminProfile[]);
      setAssignments(groupedAdmins);
      setEdits({});
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const handleOwnerSave = async (branchId: string) => {
    const selected = ownerSelection[branchId] ?? null;
    const { error: updateError } = await supabase
      .from("branches")
      .update({ owner_id: selected || null })
      .eq("id", branchId);

    if (updateError) {
      setFeedback("Não foi possível atualizar o responsável.");
      return;
    }

    const owner = supers.find((user) => user.id === selected) ?? null;
    setBranches((current) => current.map((branch) => (branch.id === branchId ? { ...branch, owner_id: selected, owner_name: owner?.full_name ?? null } : branch)));
    setFeedback("Responsável atualizado.");
  };

  const handleAdminAdd = async (branchId: string) => {
    const adminId = adminSelection[branchId];
    if (!adminId) {
      setFeedback("Escolha um admin para adicionar.");
      return;
    }

    const { error: insertError } = await supabase
      .from("branch_admins")
      .insert({ branch_id: branchId, user_id: adminId, assigned_by: userId ?? undefined });

    if (insertError) {
      setFeedback("Não foi possível vincular o admin.");
      return;
    }

    const profile = admins.find((user) => user.id === adminId) ?? null;
    setAssignments((current) => {
      const currentList = current[branchId] ?? [];
      return {
        ...current,
        [branchId]: [
          ...currentList,
          { id: crypto.randomUUID(), branch_id: branchId, user_id: adminId, profile: profile ? { ...profile } : null },
        ],
      };
    });
    setAdminSelection((state) => ({ ...state, [branchId]: "" }));
    setFeedback("Admin vinculado à filial.");
  };

  const handleAdminRemove = async (assignmentId: string, branchId: string) => {
    const { error: deleteError } = await supabase.from("branch_admins").delete().eq("id", assignmentId);

    if (deleteError) {
      setFeedback("Não foi possível remover este vínculo.");
      return;
    }

    setAssignments((current) => ({
      ...current,
      [branchId]: (current[branchId] ?? []).filter((assignment) => assignment.id !== assignmentId),
    }));
  };

  const handleBranchUpdate = async (branchId: string) => {
    const form = edits[branchId];
    if (!form || !form.name.trim()) {
      setFeedback("Preencha o nome para salvar.");
      return;
    }

    const { error: updateError } = await supabase
      .from("branches")
      .update({ name: form.name.trim(), timezone: form.timezone })
      .eq("id", branchId);

    if (updateError) {
      setFeedback("Não foi possível atualizar a filial.");
      return;
    }

    setBranches((current) =>
      current.map((branch) => (branch.id === branchId ? { ...branch, name: form.name.trim(), timezone: form.timezone } : branch))
    );
    setFeedback("Filial atualizada.");
  };

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>Admin master</span>
          <h2 className={styles.heroTitle}>Filiais e responsáveis</h2>
          <p className={styles.heroSubtitle}>Gerencie owners e admins por filial sem depender de um hub central.</p>
        </div>
      </section>

      {error ? <div className={styles.mutedPanel}>{error}</div> : null}

      <div className={styles.gridTwoColumns}>
        {loading ? <div className={styles.panelCard}>Carregando...</div> : null}
        {!loading && branches.length === 0 ? <div className={styles.mutedPanel}>Nenhuma filial cadastrada.</div> : null}

        {branches.map((branch) => {
          const form = edits[branch.id] ?? { name: branch.name, timezone: branch.timezone };
          return (
            <div key={branch.id} className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>{branch.name}</h3>
                <p className={styles.panelSubtitle}>Owner: {branch.owner_name ?? "Sem responsável"}</p>
              </div>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Nome</span>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={(event) => setEdits((state) => ({ ...state, [branch.id]: { ...form, name: event.target.value } }))}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Fuso horário</span>
                <select
                  className={styles.input}
                  value={form.timezone}
                  onChange={(event) =>
                    setEdits((state) => ({ ...state, [branch.id]: { ...form, timezone: event.target.value } }))
                  }
                >
                  {TIMEZONE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Responsável (admin super)</span>
                <select
                  className={styles.input}
                  value={ownerSelection[branch.id] ?? branch.owner_id ?? ""}
                  onChange={(event) => setOwnerSelection((state) => ({ ...state, [branch.id]: event.target.value }))}
                >
                  <option value="">Sem responsável</option>
                  {supers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name ?? "Admin super"} ({user.email ?? "sem e-mail"})
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-3">
                <button className={styles.primaryButton} type="button" onClick={() => void handleOwnerSave(branch.id)}>
                  Salvar responsável
                </button>
                <button className={styles.secondaryButton} type="button" onClick={() => void handleBranchUpdate(branch.id)}>
                  Atualizar filial
                </button>
              </div>

              <div className={styles.branchAdminBlock}>
                <p className={styles.branchAdminHelper}>Admins vinculados</p>
                <ul className={styles.branchAdminList}>
                  {(assignments[branch.id] ?? []).map((assignment) => (
                    <li key={assignment.id} className={styles.branchAdminItem}>
                      <span className={styles.branchAdminTag}>
                        {assignment.profile?.full_name ?? "Admin"} · {assignment.profile?.email ?? "sem e-mail"}
                      </span>
                      <button
                        type="button"
                        className={styles.inlineDanger}
                        onClick={() => void handleAdminRemove(assignment.id, branch.id)}
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Adicionar admin</span>
                  <select
                    className={styles.input}
                    value={adminSelection[branch.id] ?? ""}
                    onChange={(event) => setAdminSelection((state) => ({ ...state, [branch.id]: event.target.value }))}
                  >
                    <option value="">Escolha um usuário</option>
                    {admins.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name ?? "Usuário"} ({user.email ?? "sem e-mail"})
                      </option>
                    ))}
                  </select>
                </label>
                <button className={styles.primaryButton} type="button" onClick={() => void handleAdminAdd(branch.id)}>
                  Vincular admin
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {feedback ? <div className={`${styles.feedback} ${styles.feedbackSuccess}`}>{feedback}</div> : null}
    </div>
  );
}

export default function MasterBranchesPanel() {
  return (
    <PanelGuard
      allowedRoles={["adminmaster"]}
      fallbackRedirects={{
        admin: "/admin",
        adminsuper: "/admin/adminsuper",
        client: "/login",
        unauthenticated: "/login",
      }}
    >
      {() => <MasterBranchesContent />}
    </PanelGuard>
  );
}
