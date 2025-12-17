"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/db";
import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";
import { useCurrentUserId } from "@/app/(admin)/@components/useCurrentUserId";

import styles from "../../../adminPanel.module.css";

type Branch = { id: string; name: string };

type AdminProfile = { id: string; full_name: string | null; email: string | null };

type BranchAdminAssignment = { id: string; branch_id: string; user_id: string; profile: AdminProfile | null };

function SuperBranchAdminsContent() {
  const { userId, loading: userLoading } = useCurrentUserId();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminProfile[]>([]);
  const [assignments, setAssignments] = useState<Record<string, BranchAdminAssignment[]>>({});
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (userLoading) return;

      if (!userId) {
        setError("Sessão inválida");
        setLoading(false);
        return;
      }

      setError(null);
      setLoading(true);

      const { data: branchData, error: branchError } = await supabase
        .from("branches")
        .select("id, name")
        .eq("owner_id", userId)
        .order("name", { ascending: true });

      if (!active) return;

      if (branchError) {
        setError("Não foi possível carregar suas filiais.");
        setLoading(false);
        return;
      }

      const branchIds = (branchData ?? []).map((branch) => branch.id);
      setBranches((branchData ?? []) as Branch[]);

      const [{ data: adminsData }, { data: assignmentsData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "admin")
          .order("full_name", { ascending: true }),
        branchIds.length
          ? supabase
              .from("branch_admins")
              .select("id, branch_id, user_id, profiles:profiles!branch_admins_user_id_fkey(id, full_name, email)")
              .in("branch_id", branchIds)
          : Promise.resolve({ data: [] }),
      ]);

      if (!active) return;

      const groupedAssignments = (assignmentsData ?? []).reduce<Record<string, BranchAdminAssignment[]>>(
        (acc, entry) => {
          const profile = Array.isArray(entry.profiles)
            ? (entry.profiles[0] as AdminProfile | undefined)
            : (entry.profiles as AdminProfile | undefined);
          const mapped: BranchAdminAssignment = {
            id: entry.id,
            branch_id: entry.branch_id,
            user_id: entry.user_id,
            profile: profile ?? null,
          };

          const current = acc[entry.branch_id] ?? [];
          return { ...acc, [entry.branch_id]: [...current, mapped] };
        },
        {}
      );

      setAssignments(groupedAssignments);
      setAdminUsers((adminsData ?? []) as AdminProfile[]);
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [userId, userLoading]);

  const handleAdd = async (branchId: string) => {
    if (!userId) return;
    const adminId = selection[branchId];

    if (!adminId) {
      setFeedback("Escolha um admin para vincular.");
      return;
    }

    const { error: insertError } = await supabase
      .from("branch_admins")
      .insert({ branch_id: branchId, user_id: adminId, assigned_by: userId });

    if (insertError) {
      setFeedback("Não foi possível adicionar o admin.");
      return;
    }

    setFeedback("Admin vinculado à filial.");
    setSelection((state) => ({ ...state, [branchId]: "" }));

    setAssignments((current) => {
      const currentList = current[branchId] ?? [];
      const profile = adminUsers.find((admin) => admin.id === adminId) ?? null;
      return {
        ...current,
        [branchId]: [...currentList, { id: crypto.randomUUID(), branch_id: branchId, user_id: adminId, profile }],
      };
    });
  };

  const handleRemove = async (assignmentId: string, branchId: string) => {
    const { error: deleteError } = await supabase.from("branch_admins").delete().eq("id", assignmentId);

    if (deleteError) {
      setFeedback("Não foi possível remover o admin desta filial.");
      return;
    }

    setAssignments((current) => ({
      ...current,
      [branchId]: (current[branchId] ?? []).filter((assignment) => assignment.id !== assignmentId),
    }));
  };

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>Admin super</span>
          <h2 className={styles.heroTitle}>Admins das suas filiais</h2>
          <p className={styles.heroSubtitle}>Vincule ou remova admins apenas nas filiais sob sua responsabilidade.</p>
        </div>
      </section>

      {error ? <div className={styles.mutedPanel}>{error}</div> : null}

      <div className={styles.gridTwoColumns}>
        {loading ? <div className={styles.panelCard}>Carregando...</div> : null}
        {!loading && branches.length === 0 ? <div className={styles.mutedPanel}>Nenhuma filial para gerenciar.</div> : null}
        {branches.map((branch) => (
          <div key={branch.id} className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>{branch.name}</h3>
              <p className={styles.panelSubtitle}>Admins vinculados: {(assignments[branch.id] ?? []).length}</p>
            </div>

            <div className={styles.branchAdminBlock}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Selecionar admin</span>
                <select
                  className={styles.input}
                  value={selection[branch.id] ?? ""}
                  onChange={(event) => setSelection((state) => ({ ...state, [branch.id]: event.target.value }))}
                >
                  <option value="">Escolha um admin</option>
                  {adminUsers.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.full_name ?? "Admin"} ({admin.email ?? "sem e-mail"})
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-3">
                <button className={styles.primaryButton} type="button" onClick={() => void handleAdd(branch.id)}>
                  Vincular admin
                </button>
              </div>
            </div>

            <ul className={styles.branchAdminList}>
              {(assignments[branch.id] ?? []).map((assignment) => (
                <li key={assignment.id} className={styles.branchAdminItem}>
                  <span className={styles.branchAdminTag}>
                    {assignment.profile?.full_name ?? "Admin"} · {assignment.profile?.email ?? "sem e-mail"}
                  </span>
                  <button
                    type="button"
                    className={styles.inlineDanger}
                    onClick={() => void handleRemove(assignment.id, branch.id)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {feedback ? <div className={`${styles.feedback} ${styles.feedbackSuccess}`}>{feedback}</div> : null}
    </div>
  );
}

export default function SuperBranchAdminsPanel() {
  return (
    <PanelGuard
      allowedRoles={["adminsuper"]}
      fallbackRedirects={{
        admin: "/admin",
        adminmaster: "/admin/adminmaster",
        client: "/login",
        unauthenticated: "/login",
      }}
    >
      {() => <SuperBranchAdminsContent />}
    </PanelGuard>
  );
}
