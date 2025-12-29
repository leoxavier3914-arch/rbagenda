"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";
import { slugify } from "@/lib/slug";

import { useAdminGuard } from "../../useAdminGuard";
import styles from "./servicos.module.css";

type CategoryOption = {
  id: string;
  name: string;
  order_index: number;
  active: boolean;
};

type ServiceTypeRow = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  active: boolean;
  order_index: number;
  category_id: string | null;
  category?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
  branch_id: string | null;
  branch?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
  assignments?:
    | {
        services?:
          | { id?: string | null; name?: string | null; active?: boolean | null }
          | { id?: string | null; name?: string | null; active?: boolean | null }[]
          | null;
      }[]
    | null;
};

type NormalizedService = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  active: boolean;
  order_index: number;
  category_id: string | null;
  category_name: string | null;
  branch_name: string | null;
  techniques: string[];
};

type ServiceFormState = {
  name: string;
  slug: string;
  description: string;
  order_index: number;
  active: boolean;
  category_id: string;
};

const defaultForm: ServiceFormState = {
  name: "",
  slug: "",
  description: "",
  order_index: 0,
  active: true,
  category_id: "",
};

const normalizeOrder = (value: string | number) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

const normalizeSlug = (value: string, fallback: string) => {
  const base = value?.trim().length ? value : fallback;
  return slugify(base || "servico");
};

const dedupeTechniques = (assignments: ServiceTypeRow["assignments"]) => {
  const seen = new Set<string>();
  const names: string[] = [];

  (assignments ?? []).forEach((assignment) => {
    const servicesValue = assignment?.services;
    const services = Array.isArray(servicesValue) ? servicesValue : servicesValue ? [servicesValue] : [];
    services.forEach((service) => {
      if (!service || service.active === false) return;
      if (!service.id || seen.has(service.id)) return;
      seen.add(service.id);
      if (service.name && service.name.trim().length > 0) {
        names.push(service.name.trim());
      }
    });
  });

  return names;
};

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

export default function ServicosPage() {
  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [serviceTypes, setServiceTypes] = useState<NormalizedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceFormState>(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const isSuper = role === "adminsuper" || role === "adminmaster";
  const isReadonly = role === "admin";

  useEffect(() => {
    if (status !== "authorized") return;
    void loadData();
  }, [status]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setNote(null);

    const [categoriesResponse, servicesResponse] = await Promise.all([
      supabase
        .from("service_categories")
        .select("id, name, order_index, active")
        .order("order_index", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true }),
      supabase
        .from("service_types")
        .select(
          "id, name, slug, description, active, order_index, category_id, branch_id, category:service_categories(id, name), branch:branches(id, name), assignments:service_type_assignments(services:services(id, name, active))"
        )
        .order("order_index", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true }),
    ]);

    if (categoriesResponse.error || servicesResponse.error) {
      setError("Não foi possível carregar os serviços.");
      setCategories([]);
      setServiceTypes([]);
      setLoading(false);
      return;
    }

    const categoryOptions =
      (categoriesResponse.data ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name ?? "Categoria",
        order_index: normalizeOrder(entry.order_index ?? 0),
        active: entry.active !== false,
      })) ?? [];

    const normalizedServices =
      (servicesResponse.data ?? []).map((entry: ServiceTypeRow) => {
        const category = toArray(entry.category).find((cat) => cat && typeof cat === "object");
        const branch = toArray(entry.branch).find((br) => br && typeof br === "object");

        return {
          id: entry.id,
          name: entry.name ?? "Serviço",
          slug: entry.slug ?? null,
          description: entry.description ?? null,
          active: entry.active !== false,
          order_index: normalizeOrder(entry.order_index ?? 0),
          category_id: entry.category_id ?? null,
          category_name: category?.name ?? null,
          branch_name: branch?.name ?? null,
          techniques: dedupeTechniques(entry.assignments),
        };
      }) ?? [];

    setCategories(categoryOptions);
    setServiceTypes(
      normalizedServices.sort((a, b) => {
        if (a.order_index !== b.order_index) return a.order_index - b.order_index;
        return a.name.localeCompare(b.name, "pt-BR");
      })
    );
    setLoading(false);
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSuper) {
      setError("Apenas Master ou Super podem editar serviços.");
      return;
    }

    setSaving(true);
    setError(null);
    setNote(null);

    const payload = {
      name: form.name.trim() || "Serviço",
      slug: normalizeSlug(form.slug, form.name),
      description: form.description.trim() || null,
      active: Boolean(form.active),
      order_index: normalizeOrder(form.order_index),
      category_id: form.category_id ? form.category_id : null,
    };

    const response = editingId
      ? await supabase.from("service_types").update(payload).eq("id", editingId)
      : await supabase.from("service_types").insert(payload);

    if (response.error) {
      setError("Não foi possível salvar o serviço. Verifique o slug e as permissões.");
    } else {
      setNote(editingId ? "Serviço atualizado." : "Serviço criado.");
      resetForm();
      void loadData();
    }

    setSaving(false);
  };

  const handleEdit = (service: NormalizedService) => {
    setEditingId(service.id);
    setForm({
      name: service.name ?? "",
      slug: service.slug ?? "",
      description: service.description ?? "",
      order_index: normalizeOrder(service.order_index),
      active: service.active !== false,
      category_id: service.category_id ?? "",
    });
    setNote("Editando serviço. Salve para confirmar ou cancele para limpar.");
  };

  const categoryOrder = useMemo(() => {
    const map = new Map<string, { order: number; name: string }>();
    categories.forEach((cat) => {
      map.set(cat.id, { order: cat.order_index, name: cat.name });
    });
    return map;
  }, [categories]);

  const groupedServices = useMemo(() => {
    const groups = new Map<string, { label: string; order: number; items: NormalizedService[] }>();

    serviceTypes.forEach((service) => {
      const key = service.category_id ?? "sem-ramo";
      const categoryMeta = service.category_id ? categoryOrder.get(service.category_id) : null;
      const order = categoryMeta?.order ?? Number.POSITIVE_INFINITY;
      const label = service.category_name ?? categoryMeta?.name ?? "Sem ramo";

      if (!groups.has(key)) {
        groups.set(key, { label, order, items: [] });
      }
      groups.get(key)?.items.push(service);
    });

    return Array.from(groups.entries())
      .map(([key, value]) => ({ key, ...value, items: value.items.sort((a, b) => a.order_index - b.order_index) }))
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label, "pt-BR");
      });
  }, [categoryOrder, serviceTypes]);

  return (
    <div className={styles.page}>
      <section className={styles.headerCard}>
        <h1 className={styles.headerTitle}>Serviços</h1>
        <p className={styles.headerDescription}>
          Gerencie os serviços (service_types) e vincule cada um a um ramo. Técnicas vinculadas continuam sendo exibidas no
          agrupamento por ramo.
        </p>
        <div className={styles.tagRow}>
          <span className={styles.tag}>Agrupamento por ramo</span>
          {!isSuper ? <span className={styles.tag}>Modo somente leitura</span> : null}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>{editingId ? "Editar serviço" : "Novo serviço"}</p>
          <h2 className={styles.sectionTitle}>{editingId ? "Atualize um serviço existente" : "Cadastre um serviço"}</h2>
          <p className={styles.sectionDescription}>
            Defina nome, slug e a ordenação. Use o seletor para associar o serviço a um ramo ativo.
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
              placeholder="Serviço (ex: Depilação)"
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
              placeholder="identificador-unico"
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
            <p className={styles.helperText}>Serviços com ordem menor aparecem primeiro.</p>
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Categoria</span>
            <select
              className={styles.selectControl}
              value={form.category_id}
              onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))}
              disabled={saving || isReadonly}
            >
              <option value="">Sem categoria</option>
              {categories
                .filter((category) => category.active)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
            <p className={styles.helperText}>Apenas categorias ativas são exibidas.</p>
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Descrição</span>
            <textarea
              className={styles.textareaControl}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Detalhes do serviço"
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
            <span className={styles.inputLabel}>Serviço ativo</span>
          </label>
          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryButton} disabled={saving || isReadonly}>
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar serviço"}
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
          <p className={styles.sectionEyebrow}>Serviços agrupados</p>
          <h2 className={styles.sectionTitle}>Visualização por ramo</h2>
          <p className={styles.sectionDescription}>
            Veja os serviços agrupados pelo ramo selecionado e confira as técnicas vinculadas a cada um.
          </p>
        </div>

        {loading ? (
          <div className={styles.helperText}>Carregando serviços...</div>
        ) : groupedServices.length ? (
          <div className={styles.groupGrid}>
            {groupedServices.map((group) => (
              <div key={group.key} className={styles.groupCard}>
                <div className={styles.groupHeader}>
                  <h3 className={styles.groupTitle}>{group.label}</h3>
                  <span className={`${styles.badge} ${styles.statusActive}`}>{group.items.length} serviços</span>
                </div>
                {group.items.map((service) => (
                  <div key={service.id} className={styles.serviceRow}>
                    <div className={styles.serviceHeader}>
                      <div className={styles.rowMeta}>
                        <h4 className={styles.serviceTitle}>{service.name}</h4>
                        <span className={`${styles.badge} ${service.active ? styles.statusActive : styles.statusInactive}`}>
                          {service.active ? "Ativo" : "Inativo"}
                        </span>
                        {service.branch_name ? <span className={styles.pill}>{service.branch_name}</span> : null}
                      </div>
                      <span className={styles.muted}>{service.slug || "Sem slug"}</span>
                      <p className={styles.sectionDescription}>{service.description || "Sem descrição"}</p>
                    </div>
                    <div className={styles.pillGroup}>
                      {service.techniques.length ? (
                        service.techniques.map((technique) => (
                          <span key={technique} className={styles.pill}>
                            {technique}
                          </span>
                        ))
                      ) : (
                        <span className={styles.muted}>Nenhuma técnica vinculada</span>
                      )}
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => handleEdit(service)}
                        disabled={saving || isReadonly}
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>Nenhum serviço cadastrado.</div>
        )}
      </section>
    </div>
  );
}
