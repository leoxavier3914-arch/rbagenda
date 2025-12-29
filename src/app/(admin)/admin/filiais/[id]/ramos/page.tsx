"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { supabase } from "@/lib/db";

import { useAdminGuard } from "../../../../useAdminGuard";
import styles from "./ramos.module.css";

type ServiceCategory = {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  active: boolean;
};

type BranchCategory = {
  category_id: string;
  is_enabled: boolean | null;
};

const normalizeOrder = (value: string | number) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

export default function BranchRamosPage() {
  const params = useParams();
  const router = useRouter();
  const branchIdParam = params?.id;
  const branchId = Array.isArray(branchIdParam) ? branchIdParam[0] : branchIdParam;
  const { status } = useAdminGuard({
    allowedRoles: ["adminsuper", "adminmaster"],
    fallbackRedirects: { admin: "/admin", client: "/meu-perfil", unauthenticated: "/login" },
  });

  const [branchName, setBranchName] = useState<string>("Filial");
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authorized" || !branchId) return;
    void loadData(branchId);
  }, [status, branchId]);

  const loadData = async (currentBranchId: string) => {
    setLoading(true);
    setError(null);
    setNote(null);

    const [{ data: branchData, error: branchError }, { data: categoryData, error: categoryError }, { data: enabledData, error: enabledError }] =
      await Promise.all([
        supabase.from("branches").select("id, name").eq("id", currentBranchId).maybeSingle(),
        supabase
          .from("service_categories")
          .select("id, name, description, order_index, active")
          .eq("active", true)
          .order("order_index", { ascending: true, nullsFirst: true })
          .order("name", { ascending: true }),
        supabase.from("branch_service_categories").select("category_id, is_enabled").eq("branch_id", currentBranchId),
      ]);

    if (branchError) {
      setError("Filial não encontrada ou sem acesso.");
      setCategories([]);
      setLoading(false);
      return;
    }

    setBranchName(branchData?.name ?? "Filial");

    if (categoryError) {
      setError("Não foi possível carregar os ramos disponíveis.");
      setCategories([]);
      setLoading(false);
      return;
    }

    if (enabledError) {
      setError("Não foi possível carregar as configurações da filial.");
      setCategories([]);
      setLoading(false);
      return;
    }

    const normalizedCategories =
      (categoryData ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name ?? "Ramo",
        description: entry.description ?? null,
        order_index: normalizeOrder(entry.order_index ?? 0),
        active: entry.active !== false,
      })) ?? [];

    const enabledSet = new Set<string>();
    (enabledData ?? []).forEach((row: BranchCategory) => {
      if (row.is_enabled !== false && row.category_id) {
        enabledSet.add(row.category_id);
      }
    });

    setCategories(normalizedCategories);
    setSelectedCategories(enabledSet);
    setLoading(false);
  };

  const handleToggle = (categoryId: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!branchId) return;
    setSaving(true);
    setError(null);
    setNote(null);

    const payload = categories.map((category) => ({
      branch_id: branchId,
      category_id: category.id,
      is_enabled: selectedCategories.has(category.id),
    }));

    const { error: upsertError } = await supabase
      .from("branch_service_categories")
      .upsert(payload, { onConflict: "branch_id,category_id" });

    if (upsertError) {
      setError("Não foi possível salvar as habilitações de ramos.");
    } else {
      setNote("Ramos habilitados para a filial foram atualizados.");
    }

    setSaving(false);
  };

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.order_index !== b.order_index) return a.order_index - b.order_index;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [categories]);

  return (
    <div className={styles.page}>
      <section className={styles.headerCard}>
        <h1 className={styles.headerTitle}>Ramos da filial</h1>
        <p className={styles.headerDescription}>
          Escolha quais ramos ficam disponíveis na filial selecionada. Apenas ramos ativos podem ser habilitados.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Filial</p>
          <h2 className={styles.sectionTitle}>{branchName}</h2>
          <p className={styles.sectionDescription}>
            Habilite ou desabilite ramos. No futuro, o cliente verá a seleção automática com base nas opções habilitadas.
          </p>
        </div>

        {error ? <div className={styles.helperText}>{error}</div> : null}
        {note ? <div className={styles.helperText}>{note}</div> : null}

        {loading ? (
          <div className={styles.helperText}>Carregando ramos...</div>
        ) : sortedCategories.length ? (
          sortedCategories.map((category) => (
            <div key={category.id} className={styles.card}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={selectedCategories.has(category.id)}
                  onChange={() => handleToggle(category.id)}
                  disabled={saving}
                />
                <div>
                  <h3 className={styles.categoryTitle}>{category.name}</h3>
                  <p className={styles.muted}>{category.description || "Sem descrição"}</p>
                </div>
              </label>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>Nenhum ramo ativo disponível.</div>
        )}

        <div className={styles.buttonRow}>
          <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar ramos da filial"}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => router.push("/admin/filiais")} disabled={saving}>
            Voltar
          </button>
        </div>
      </section>
    </div>
  );
}
