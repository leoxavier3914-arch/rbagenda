"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";
import { slugify } from "@/lib/slug";

import { useAdminGuard } from "../../useAdminGuard";
import styles from "./ramos.module.css";

type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  order_index: number;
  created_at: string | null;
};

type CategoryFormState = {
  name: string;
  slug: string;
  description: string;
  active: boolean;
  order_index: number;
};

const defaultForm: CategoryFormState = {
  name: "",
  slug: "",
  description: "",
  active: true,
  order_index: 0,
};

const normalizeOrder = (value: string | number) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

const normalizeSlug = (value: string, fallback: string) => {
  const base = value?.trim().length ? value : fallback;
  return slugify(base || "ramo");
};

export default function RamosPage() {
  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const isSuper = role === "adminsuper" || role === "adminmaster";
  const isReadonly = role === "admin";

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.order_index !== b.order_index) return a.order_index - b.order_index;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [categories]);

  useEffect(() => {
    if (status !== "authorized") return;
    void loadCategories();
  }, [status]);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    setNote(null);
    const { data, error: fetchError } = await supabase
      .from("service_categories")
      .select("id, name, slug, description, active, order_index, created_at")
      .order("order_index", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true });

    if (fetchError) {
      setError("Não foi possível carregar os ramos.");
      setCategories([]);
    } else {
      setCategories(
        (data ?? []).map((entry) => ({
          ...entry,
          description: entry.description ?? null,
          active: entry.active !== false,
          order_index: normalizeOrder(entry.order_index ?? 0),
        }))
      );
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSuper) {
      setError("Apenas Master ou Super podem editar ramos.");
      return;
    }

    setSaving(true);
    setError(null);
    setNote(null);

    const payload = {
      name: form.name.trim() || "Ramo",
      slug: normalizeSlug(form.slug, form.name),
      description: form.description.trim() || null,
      active: Boolean(form.active),
      order_index: normalizeOrder(form.order_index),
    };

    const response = editingId
      ? await supabase.from("service_categories").update(payload).eq("id", editingId)
      : await supabase.from("service_categories").insert(payload);

    if (response.error) {
      setError("Não foi possível salvar o ramo. Verifique o slug e tente novamente.");
    } else {
      setNote(editingId ? "Ramo atualizado com sucesso." : "Ramo criado com sucesso.");
      resetForm();
      void loadCategories();
    }

    setSaving(false);
  };

  const handleEdit = (category: ServiceCategory) => {
    setEditingId(category.id);
    setForm({
      name: category.name ?? "",
      slug: category.slug ?? "",
      description: category.description ?? "",
      active: category.active !== false,
      order_index: normalizeOrder(category.order_index),
    });
    setNote("Editando ramo existente. Salve para confirmar ou use cancelar para limpar.");
  };

  const handleDelete = async (categoryId: string) => {
    if (!isSuper) {
      setError("Apenas Master ou Super podem excluir ramos.");
      return;
    }
    if (!window.confirm("Tem certeza que deseja excluir este ramo?")) return;

    setSaving(true);
    setError(null);
    setNote(null);

    const { error: deleteError } = await supabase.from("service_categories").delete().eq("id", categoryId);
    if (deleteError) {
      setError("Não foi possível excluir o ramo. Verifique dependências e tente novamente.");
    } else {
      setNote("Ramo excluído.");
      if (editingId === categoryId) resetForm();
      void loadCategories();
    }

    setSaving(false);
  };

  return (
    <div className={styles.page}>
      <section className={styles.headerCard}>
        <h1 className={styles.headerTitle}>Ramos</h1>
        <p className={styles.headerDescription}>
          Organize os ramos de serviços e defina a ordem exibida no painel. Apenas usuários Master e Super podem criar, editar ou
          excluir; administradores comuns têm acesso somente leitura.
        </p>
        <div className={styles.tagRow}>
          <span className={styles.tag}>CRUD de Ramos</span>
          {isReadonly ? <span className={styles.tag}>Modo somente leitura</span> : null}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>{editingId ? "Editar ramo" : "Novo ramo"}</p>
          <h2 className={styles.sectionTitle}>{editingId ? "Atualize um ramo existente" : "Cadastre um novo ramo"}</h2>
          <p className={styles.sectionDescription}>
            Defina nome, slug e ordenação. Desative o ramo quando não quiser mais exibi-lo nas filiais ou serviços.
          </p>
        </div>

        {error ? <div className={styles.helperText}>{error}</div> : null}
        {note ? <div className={styles.helperText}>{note}</div> : null}

        <form className={styles.formGrid} onSubmit={handleSubmit}>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Nome</span>
            <input
              className={styles.inputControl}
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                  slug: prev.slug || slugify(event.target.value),
                }))
              }
              placeholder="Ramo (ex: Estética)"
              disabled={saving || isReadonly}
              required
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Slug</span>
            <input
              className={styles.inputControl}
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              onBlur={(event) => setForm((prev) => ({ ...prev, slug: normalizeSlug(event.target.value, prev.name) }))}
              placeholder="Identificador único"
              disabled={saving || isReadonly}
              required
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Ordem</span>
            <input
              className={styles.inputControl}
              type="number"
              min={0}
              value={form.order_index}
              onChange={(event) => setForm((prev) => ({ ...prev, order_index: normalizeOrder(event.target.value) }))}
              disabled={saving || isReadonly}
            />
            <p className={styles.helperText}>Ramos com ordem menor aparecem primeiro.</p>
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Descrição</span>
            <textarea
              className={styles.textareaControl}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Explicação breve do ramo"
              disabled={saving || isReadonly}
            />
          </label>
          <label className={`${styles.inputGroup} ${styles.toggleRow}`}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
              disabled={saving || isReadonly}
            />
            <span className={styles.inputLabel}>Ramo ativo</span>
          </label>
          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryButton} disabled={saving || isReadonly}>
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar ramo"}
            </button>
            {editingId ? (
              <button type="button" className={styles.secondaryButton} onClick={resetForm} disabled={saving}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Lista de ramos</p>
          <h2 className={styles.sectionTitle}>Catálogo atual</h2>
          <p className={styles.sectionDescription}>Visualize todos os ramos disponíveis e gerencie a ordem e ativação.</p>
        </div>

        {loading ? (
          <div className={styles.helperText}>Carregando ramos...</div>
        ) : sortedCategories.length ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ramo</th>
                  <th>Slug</th>
                  <th>Ordem</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className={styles.sectionTitle}>{category.name}</div>
                      <p className={styles.sectionDescription}>{category.description || "Sem descrição"}</p>
                    </td>
                    <td className={styles.muted}>{category.slug}</td>
                    <td>{category.order_index}</td>
                    <td>
                      <span
                        className={`${styles.statusChip} ${
                          category.active ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        {category.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => handleEdit(category)}
                          disabled={saving || isReadonly}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => handleDelete(category.id)}
                          disabled={saving || isReadonly}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>Nenhum ramo cadastrado.</div>
        )}
      </section>
    </div>
  );
}
