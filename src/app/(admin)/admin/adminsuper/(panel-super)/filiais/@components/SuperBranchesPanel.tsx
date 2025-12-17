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
  created_at: string;
};

const TIMEZONE_OPTIONS = ["America/Sao_Paulo", "America/Bahia", "America/Recife", "America/Manaus", "America/Fortaleza"];

function SuperBranchesContent() {
  const { userId, loading: userLoading } = useCurrentUserId();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [edits, setEdits] = useState<Record<string, { name: string; timezone: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadBranches = async () => {
      if (userLoading) return;

      if (!userId) {
        setError("Sessão inválida");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("branches")
        .select("id, name, timezone, created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (queryError) {
        setError("Não foi possível carregar suas filiais.");
        setLoading(false);
        return;
      }

      const normalized = (data ?? []).map((branch) => ({
        id: branch.id,
        name: branch.name ?? "Filial",
        timezone: branch.timezone ?? TIMEZONE_OPTIONS[0],
        created_at: branch.created_at,
      }));

      setBranches(normalized);
      setEdits({});
      setLoading(false);
    };

    void loadBranches();

    return () => {
      active = false;
    };
  }, [userId, userLoading]);

  const handleUpdate = async (branchId: string) => {
    const form = edits[branchId];
    const current = branches.find((branch) => branch.id === branchId);

    if (!form || !form.name.trim() || !current) {
      setFeedback("Preencha os campos antes de salvar.");
      return;
    }

    const { error: updateError } = await supabase
      .from("branches")
      .update({ name: form.name.trim(), timezone: form.timezone })
      .eq("id", branchId)
      .eq("owner_id", userId ?? "");

    if (updateError) {
      setFeedback("Não foi possível atualizar a filial.");
      return;
    }

    setBranches((currentBranches) =>
      currentBranches.map((branch) =>
        branch.id === branchId ? { ...branch, name: form.name.trim(), timezone: form.timezone } : branch
      )
    );
    setFeedback("Filial atualizada.");
  };

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>Admin super</span>
          <h2 className={styles.heroTitle}>Filiais sob sua responsabilidade</h2>
          <p className={styles.heroSubtitle}>Cada item aqui pertence ao owner atual. Edição limitada ao nome e fuso.</p>
        </div>
      </section>

      {error ? <div className={styles.mutedPanel}>{error}</div> : null}

      <div className={styles.gridTwoColumns}>
        {loading ? <div className={styles.panelCard}>Carregando...</div> : null}
        {!loading && branches.length === 0 ? <div className={styles.mutedPanel}>Nenhuma filial atribuída.</div> : null}
        {branches.map((branch) => {
          const form = edits[branch.id] ?? { name: branch.name, timezone: branch.timezone };
          return (
            <div key={branch.id} className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>{branch.name}</h3>
                <p className={styles.panelSubtitle}>Criada em {new Date(branch.created_at).toLocaleDateString("pt-BR")}</p>
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

              <div className="flex gap-3">
                <button className={styles.primaryButton} type="button" onClick={() => void handleUpdate(branch.id)}>
                  Salvar filial
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

export default function SuperBranchesPanel() {
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
      {() => <SuperBranchesContent />}
    </PanelGuard>
  );
}
