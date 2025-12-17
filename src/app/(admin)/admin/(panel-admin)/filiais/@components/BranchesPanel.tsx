"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/db";
import { useAdminBranch } from "@/app/(admin)/@components/AdminBranchContext";
import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";

import styles from "../../../adminPanel.module.css";

type Branch = {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
};

const TIMEZONE_OPTIONS = ["America/Sao_Paulo", "America/Bahia", "America/Recife", "America/Manaus", "America/Fortaleza"];

function BranchesContent() {
  const { activeBranchId, branchScope, loading: branchLoading } = useAdminBranch();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: "", timezone: TIMEZONE_OPTIONS[0] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadBranch = async () => {
      if (branchLoading) return;

      if (branchScope !== "branch" || !activeBranchId) {
        setBranch(null);
        setForm({ name: "", timezone: TIMEZONE_OPTIONS[0] });
        setError("Selecione uma filial atribuída para editar os dados.");
        setLoading(false);
        return;
      }

      setError(null);
      setFeedback(null);
      setLoading(true);

      const { data, error: queryError } = await supabase
        .from("branches")
        .select("id, name, timezone, created_at")
        .eq("id", activeBranchId)
        .maybeSingle();

      if (!active) return;

      if (queryError || !data) {
        setBranch(null);
        setError("Não foi possível carregar a filial selecionada.");
        setLoading(false);
        return;
      }

      setBranch(data as Branch);
      setForm({ name: data.name ?? "", timezone: data.timezone ?? TIMEZONE_OPTIONS[0] });
      setLoading(false);
    };

    void loadBranch();

    return () => {
      active = false;
    };
  }, [activeBranchId, branchLoading, branchScope]);

  const handleUpdate = async () => {
    if (!branch || !form.name.trim()) {
      setFeedback("Informe um nome válido para salvar.");
      return;
    }

    const { error: updateError } = await supabase
      .from("branches")
      .update({ name: form.name.trim(), timezone: form.timezone })
      .eq("id", branch.id);

    if (updateError) {
      setFeedback("Não foi possível atualizar a filial agora.");
      return;
    }

    setBranch((current) => (current ? { ...current, name: form.name.trim(), timezone: form.timezone } : current));
    setFeedback("Filial atualizada com sucesso.");
  };

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>Admin</span>
          <h2 className={styles.heroTitle}>Filial ativa</h2>
          <p className={styles.heroSubtitle}>
            Edite apenas a filial que você administra. Não há gestão de owners ou admins aqui, mantendo cada módulo
            independente.
          </p>
        </div>
        {branch ? (
          <div className={styles.heroMeta}>
            <p className={styles.metaTitle}>Filial selecionada</p>
            <p className={styles.metaValue}>{branch.name}</p>
            <p className={styles.heroSubtitle}>Criada em {new Date(branch.created_at).toLocaleDateString("pt-BR")}</p>
          </div>
        ) : null}
      </section>

      {branchScope !== "branch" || !activeBranchId ? (
        <div className={styles.mutedPanel}>
          <p>{error ?? "Selecione uma filial para liberar as edições."}</p>
        </div>
      ) : null}

      {branchScope === "branch" && activeBranchId ? (
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Dados da filial</h3>
            <p className={styles.panelSubtitle}>Atualize apenas o essencial para esta unidade.</p>
          </div>

          {loading ? (
            <p>Carregando filial...</p>
          ) : error ? (
            <p>{error}</p>
          ) : branch ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Nome</span>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                  placeholder="Ex: Unidade Centro"
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Fuso horário</span>
                <select
                  className={styles.input}
                  value={form.timezone}
                  onChange={(event) => setForm((state) => ({ ...state, timezone: event.target.value }))}
                >
                  {TIMEZONE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2 flex flex-wrap gap-3">
                <button className={styles.primaryButton} type="button" onClick={handleUpdate} disabled={loading}>
                  Salvar alterações
                </button>
              </div>

              {feedback ? (
                <div className={`${styles.feedback} ${feedback.includes("sucesso") ? styles.feedbackSuccess : styles.feedbackError}`}>
                  {feedback}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function BranchesPanel() {
  return (
    <PanelGuard
      allowedRoles={["admin"]}
      fallbackRedirects={{
        adminsuper: "/admin/adminsuper",
        adminmaster: "/admin/adminmaster",
        client: "/login",
        unauthenticated: "/login",
      }}
    >
      {() => <BranchesContent />}
    </PanelGuard>
  );
}
