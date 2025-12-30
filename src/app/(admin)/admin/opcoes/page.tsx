/* eslint-disable @next/next/no-img-element */
"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/db";
import { slugify } from "@/lib/slug";

import { useAdminGuard } from "../../useAdminGuard";
import styles from "./opcoes.module.css";

type CategoryOption = {
  id: string;
  name: string;
  active: boolean;
  order_index: number;
};

type ServiceTypeOption = {
  id: string;
  name: string;
  active: boolean;
  category_id: string | null;
  category_name?: string | null;
  category?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
};

type ServiceAssignmentRow = {
  service_type?: ServiceTypeOption | ServiceTypeOption[] | null;
};

type ServiceRow = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  duration_min: number | null;
  price_cents: number | null;
  deposit_cents: number | null;
  buffer_min: number | null;
  active: boolean;
  branch_id: string | null;
  assignments?: ServiceAssignmentRow[] | null;
};

type NormalizedOption = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  duration_min: number;
  price_cents: number;
  deposit_cents: number;
  buffer_min: number;
  active: boolean;
  branch_id: string | null;
  serviceTypeIds: string[];
  serviceTypeNames: string[];
  categoryIds: string[];
  categoryNames: string[];
};

type ServicePhoto = {
  id: string;
  url: string | null;
  order_index: number | null;
  created_at: string | null;
};

type OptionFormState = {
  name: string;
  slug: string;
  description: string;
  duration_min: number;
  price_cents: number;
  deposit_cents: number;
  buffer_min: number;
  active: boolean;
};

const defaultForm: OptionFormState = {
  name: "",
  slug: "",
  description: "",
  duration_min: 30,
  price_cents: 0,
  deposit_cents: 0,
  buffer_min: 15,
  active: true,
};

const normalizeInt = (value: string | number, fallback = 0) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
};

const normalizeSlug = (value: string, fallback: string) => {
  const base = value?.trim().length ? value : fallback;
  return slugify(base || "opcao");
};

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const resolveCategoryMeta = (serviceType: ServiceTypeOption) => {
  const categoryEntry = toArray(serviceType.category).find((category) => category && typeof category === "object");
  return {
    id: serviceType.category_id ?? categoryEntry?.id ?? null,
    name: serviceType.category_name ?? categoryEntry?.name ?? null,
  };
};

export default function OpcoesPage() {
  const searchParams = useSearchParams();
  const initialServiceFilter = searchParams.get("servico") ?? "";

  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);
  const [options, setOptions] = useState<NormalizedOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OptionFormState>(defaultForm);
  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterServiceType, setFilterServiceType] = useState<string>(initialServiceFilter);
  const [onlyActive, setOnlyActive] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [photos, setPhotos] = useState<ServicePhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [photosNote, setPhotosNote] = useState<string | null>(null);

  const isSuper = role === "adminsuper" || role === "adminmaster";
  const isReadonly = role === "admin";

  useEffect(() => {
    if (status !== "authorized") return;
    void loadData();
  }, [status]);

  useEffect(() => {
    if (!editingId) {
      setPhotos([]);
      return;
    }
    void loadPhotos(editingId);
  }, [editingId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setNote(null);

    const [categoriesResponse, serviceTypesResponse, optionsResponse] = await Promise.all([
      supabase
        .from("service_categories")
        .select("id, name, active, order_index")
        .order("order_index", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true }),
      supabase
        .from("service_types")
        .select("id, name, active, category_id, order_index, category:service_categories(id, name)")
        .order("order_index", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true }),
      supabase
        .from("services")
        .select(
          "id, name, slug, description, duration_min, price_cents, deposit_cents, buffer_min, active, branch_id, assignments:service_type_assignments(service_type:service_types(id, name, category_id, category:service_categories(id, name), active))"
        )
        .order("name", { ascending: true }),
    ]);

    if (categoriesResponse.error || serviceTypesResponse.error || optionsResponse.error) {
      setError("Não foi possível carregar as opções.");
      setCategories([]);
      setServiceTypes([]);
      setOptions([]);
      setLoading(false);
      return;
    }

    const normalizedCategories =
      (categoriesResponse.data ?? []).map((category) => ({
        id: category.id,
        name: category.name ?? "Categoria",
        active: category.active !== false,
        order_index: normalizeInt(category.order_index ?? 0),
      })) ?? [];

    const normalizedServiceTypes =
      (serviceTypesResponse.data ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name ?? "Serviço",
        active: entry.active !== false,
        category_id: entry.category_id ?? null,
        category_name: toArray(entry.category).find((category) => category && typeof category === "object")?.name ?? null,
        category: entry.category ?? null,
      })) ?? [];

    const normalizedOptions =
      (optionsResponse.data ?? []).map((entry: ServiceRow) => {
        const serviceTypesList = (entry.assignments ?? [])
          .map((assignment) => {
            const services = toArray(assignment?.service_type);
            return services.filter((service) => service && typeof service === "object");
          })
          .flat()
          .filter(Boolean) as ServiceTypeOption[];

        const uniqueServiceTypes = new Map<string, ServiceTypeOption>();
        serviceTypesList.forEach((serviceType) => {
          if (!serviceType.id) return;
          if (uniqueServiceTypes.has(serviceType.id)) return;
          uniqueServiceTypes.set(serviceType.id, serviceType);
        });

        const categoryNames = new Map<string, string>();
        Array.from(uniqueServiceTypes.values()).forEach((serviceType) => {
          const { id: catId, name: catName } = resolveCategoryMeta(serviceType);
          if (catId) {
            categoryNames.set(catId, catName ?? "Categoria");
          }
        });

        return {
          id: entry.id,
          name: entry.name ?? "Opção",
          slug: entry.slug ?? null,
          description: entry.description ?? null,
          duration_min: normalizeInt(entry.duration_min ?? 30, 30) || 30,
          price_cents: normalizeInt(entry.price_cents ?? 0, 0),
          deposit_cents: normalizeInt(entry.deposit_cents ?? 0, 0),
          buffer_min: normalizeInt(entry.buffer_min ?? 15, 15),
          active: entry.active !== false,
          branch_id: entry.branch_id ?? null,
          serviceTypeIds: Array.from(uniqueServiceTypes.keys()),
          serviceTypeNames: Array.from(uniqueServiceTypes.values()).map((item) => item.name ?? "Serviço"),
          categoryIds: Array.from(categoryNames.keys()),
          categoryNames: Array.from(categoryNames.values()),
        } as NormalizedOption;
      }) ?? [];

    setCategories(normalizedCategories);
    setServiceTypes(normalizedServiceTypes);
    setOptions(normalizedOptions);
    setLoading(false);
  };

  const loadPhotos = async (serviceId: string) => {
    setPhotosLoading(true);
    setPhotosError(null);
    setPhotosNote(null);

    const { data, error: fetchError } = await supabase
      .from("service_photos")
      .select("id, url, order_index, created_at")
      .eq("service_id", serviceId)
      .order("order_index", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (fetchError) {
      setPhotosError("Não foi possível carregar as fotos da opção.");
      setPhotos([]);
    } else {
      setPhotos(data ?? []);
    }

    setPhotosLoading(false);
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
    setSelectedServiceTypeIds(new Set());
    setPhotos([]);
  };

  const handleEdit = (option: NormalizedOption) => {
    setEditingId(option.id);
    setForm({
      name: option.name ?? "",
      slug: option.slug ?? "",
      description: option.description ?? "",
      duration_min: option.duration_min,
      price_cents: option.price_cents,
      deposit_cents: option.deposit_cents,
      buffer_min: option.buffer_min,
      active: option.active !== false,
    });
    setSelectedServiceTypeIds(new Set(option.serviceTypeIds));
    setNote("Editando opção. Salve para confirmar ou cancele para limpar.");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSuper) {
      setError("Apenas Master ou Super podem editar opções.");
      return;
    }

    setSaving(true);
    setError(null);
    setNote(null);

    const payload = {
      name: form.name.trim() || "Opção",
      slug: normalizeSlug(form.slug, form.name),
      description: form.description.trim() || null,
      duration_min: Math.max(1, normalizeInt(form.duration_min, 30)),
      price_cents: Math.max(0, normalizeInt(form.price_cents, 0)),
      deposit_cents: Math.max(0, normalizeInt(form.deposit_cents, 0)),
      buffer_min: Math.max(0, normalizeInt(form.buffer_min, 15)),
      active: Boolean(form.active),
    };

    const response = editingId
      ? await supabase.from("services").update(payload).eq("id", editingId).select("id")
      : await supabase.from("services").insert(payload).select("id");

    if (response.error || !response.data?.length) {
      setError("Não foi possível salvar a opção. Verifique os campos e tente novamente.");
      setSaving(false);
      return;
    }

    const targetId = response.data[0].id as string;
    const previousAssignments = editingId ? options.find((option) => option.id === editingId)?.serviceTypeIds ?? [] : [];
    const desiredAssignments = Array.from(selectedServiceTypeIds);

    const assignmentError = await syncAssignments(targetId, previousAssignments, desiredAssignments);
    if (assignmentError) {
      setError(assignmentError);
      setSaving(false);
      return;
    }

    setNote(editingId ? "Opção atualizada." : "Opção criada.");
    resetForm();
    void loadData();
    setSaving(false);
  };

  const syncAssignments = async (serviceId: string, existing: string[], desired: string[]) => {
    const toAdd = desired.filter((id) => !existing.includes(id));
    const toRemove = existing.filter((id) => !desired.includes(id));

    if (toAdd.length) {
      const { error } = await supabase
        .from("service_type_assignments")
        .insert(toAdd.map((serviceTypeId) => ({ service_id: serviceId, service_type_id: serviceTypeId })));
      if (error) return "Não foi possível vincular todos os serviços à opção.";
    }

    if (toRemove.length) {
      const { error } = await supabase
        .from("service_type_assignments")
        .delete()
        .eq("service_id", serviceId)
        .in("service_type_id", toRemove);
      if (error) return "Não foi possível remover alguns vínculos da opção.";
    }

    return null;
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!editingId) {
      setPhotosError("Salve a opção antes de enviar fotos.");
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotosLoading(true);
    setPhotosError(null);
    setPhotosNote(null);

    const bucket = "service-photos";
    const path = `${editingId}/${Date.now()}-${file.name}`;

    const uploadResponse = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadResponse.error) {
      setPhotosError("Falha ao enviar a foto. Verifique o tamanho e tente novamente.");
      setPhotosLoading(false);
      return;
    }

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

    const { error: insertError } = await supabase.from("service_photos").insert({
      service_id: editingId,
      url: publicUrl,
      order_index: photos.length,
    });

    if (insertError) {
      setPhotosError("Foto enviada, mas não foi possível registrar no catálogo.");
    } else {
      setPhotosNote("Foto adicionada.");
      void loadPhotos(editingId);
    }

    setPhotosLoading(false);
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!editingId) return;
    setPhotosLoading(true);
    setPhotosError(null);
    setPhotosNote(null);

    const { error } = await supabase.from("service_photos").delete().eq("id", photoId);
    if (error) {
      setPhotosError("Não foi possível remover a foto.");
    } else {
      setPhotosNote("Foto removida.");
      void loadPhotos(editingId);
    }
    setPhotosLoading(false);
  };

  const handlePhotoOrderChange = async (photoId: string, orderIndex: number) => {
    setPhotosLoading(true);
    setPhotosError(null);
    setPhotosNote(null);

    const { error } = await supabase.from("service_photos").update({ order_index: orderIndex }).eq("id", photoId);
    if (error) {
      setPhotosError("Não foi possível atualizar a ordem da foto.");
    } else if (editingId) {
      setPhotosNote("Ordem atualizada.");
      void loadPhotos(editingId);
    }
    setPhotosLoading(false);
  };

  const filteredOptions = useMemo(() => {
    return options
      .filter((option) => {
        if (onlyActive && option.active === false) return false;
        if (filterCategory && !option.categoryIds.includes(filterCategory)) return false;
        if (filterServiceType && !option.serviceTypeIds.includes(filterServiceType)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [filterCategory, filterServiceType, onlyActive, options]);

  const optionsWithoutService = useMemo(() => options.filter((option) => option.serviceTypeIds.length === 0), [options]);
  const servicesWithoutOptions = useMemo(
    () => serviceTypes.filter((serviceType) => !options.some((option) => option.serviceTypeIds.includes(serviceType.id))),
    [options, serviceTypes]
  );

  return (
    <div className={styles.page}>
      <section className={styles.headerCard}>
        <h1 className={styles.headerTitle}>Opções</h1>
        <p className={styles.headerDescription}>
          Cadastre e gerencie as opções (services) e vincule-as aos Serviços desejados. Não é necessário renomear tabelas; apenas
          mantenha os vínculos e textos consistentes.
        </p>
        <div className={styles.tagRow}>
          <span className={styles.tag}>Categorias → Serviços → Opções</span>
          {!isSuper ? <span className={styles.tag}>Modo somente leitura</span> : null}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Filtros</p>
          <h2 className={styles.sectionTitle}>Refine a lista de opções</h2>
          <p className={styles.sectionDescription}>
            Filtre por categoria, serviço e status. Use o link de Serviços para abrir esta página já filtrada.
          </p>
        </div>

        <div className={styles.filterGrid}>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Categoria</span>
            <select
              className={styles.selectControl}
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              disabled={loading}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Serviço</span>
            <select
              className={styles.selectControl}
              value={filterServiceType}
              onChange={(event) => setFilterServiceType(event.target.value)}
              disabled={loading}
            >
              <option value="">Todos</option>
              {serviceTypes.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.inputGroup} ${styles.toggleRow}`}>
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(event) => setOnlyActive(event.target.checked)}
              disabled={loading}
            />
            <span className={styles.inputLabel}>Mostrar apenas opções ativas</span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>{editingId ? "Editar opção" : "Nova opção"}</p>
          <h2 className={styles.sectionTitle}>{editingId ? "Atualize uma opção existente" : "Cadastre uma opção"}</h2>
          <p className={styles.sectionDescription}>
            Defina nome, slug, duração, valores e vínculo com os serviços. O depósito é opcional; o preço precisa estar em centavos.
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
              placeholder="Opção (ex: Foxy)"
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
            <span className={styles.inputLabel}>Duração (min)</span>
            <input
              className={styles.inputControl}
              type="number"
              min={1}
              value={form.duration_min}
              onChange={(event) => setForm((prev) => ({ ...prev, duration_min: normalizeInt(event.target.value, 30) }))}
              disabled={saving || isReadonly}
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Preço (centavos)</span>
            <input
              className={styles.inputControl}
              type="number"
              min={0}
              value={form.price_cents}
              onChange={(event) => setForm((prev) => ({ ...prev, price_cents: normalizeInt(event.target.value, 0) }))}
              disabled={saving || isReadonly}
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Sinal (centavos)</span>
            <input
              className={styles.inputControl}
              type="number"
              min={0}
              value={form.deposit_cents}
              onChange={(event) => setForm((prev) => ({ ...prev, deposit_cents: normalizeInt(event.target.value, 0) }))}
              disabled={saving || isReadonly}
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Buffer (min)</span>
            <input
              className={styles.inputControl}
              type="number"
              min={0}
              value={form.buffer_min}
              onChange={(event) => setForm((prev) => ({ ...prev, buffer_min: normalizeInt(event.target.value, 15) }))}
              disabled={saving || isReadonly}
            />
            <p className={styles.helperText}>Tempo extra antes/depois da opção.</p>
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Descrição</span>
            <textarea
              className={styles.textareaControl}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Detalhes da opção"
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
            <span className={styles.inputLabel}>Opção ativa</span>
          </label>
          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryButton} disabled={saving || isReadonly}>
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar opção"}
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
          <p className={styles.sectionEyebrow}>Vínculos</p>
          <h2 className={styles.sectionTitle}>Em quais serviços esta opção aparece?</h2>
          <p className={styles.sectionDescription}>Selecione os serviços. Salvando, os vínculos são atualizados em service_type_assignments.</p>
        </div>
        <div className={styles.checkboxGrid}>
          {serviceTypes.map((service) => (
            <label key={service.id} className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={selectedServiceTypeIds.has(service.id)}
                onChange={(event) => {
                  setSelectedServiceTypeIds((prev) => {
                    const next = new Set(prev);
                    if (event.target.checked) {
                      next.add(service.id);
                    } else {
                      next.delete(service.id);
                    }
                    return next;
                  });
                }}
                disabled={saving || isReadonly}
              />
              <div className={styles.checkboxLabel}>
                <span className={styles.checkboxTitle}>{service.name}</span>
                <span className={styles.checkboxHelper}>{service.category_name || "Sem categoria"}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {editingId ? (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Fotos</p>
            <h2 className={styles.sectionTitle}>Galeria da opção</h2>
            <p className={styles.sectionDescription}>
              Envie, remova ou reordene fotos desta opção. Os registros são salvos na tabela service_photos.
            </p>
          </div>

          {photosError ? <div className={styles.helperText}>{photosError}</div> : null}
          {photosNote ? <div className={styles.helperText}>{photosNote}</div> : null}

          <div className={styles.photoActions}>
            <label className={styles.secondaryButton}>
              <input type="file" accept="image/*" hidden onChange={handlePhotoUpload} disabled={photosLoading || isReadonly} />
              {photosLoading ? "Enviando..." : "Enviar foto"}
            </label>
          </div>

          {photosLoading ? (
            <div className={styles.helperText}>Carregando fotos...</div>
          ) : photos.length ? (
            <div className={styles.photoGrid}>
              {photos.map((photo) => (
                <div key={photo.id} className={styles.photoCard}>
                  {photo.url ? <img src={photo.url} alt="" className={styles.photoPreview} /> : <div className={styles.photoPlaceholder}>Sem imagem</div>}
                  <div className={styles.photoMeta}>
                    <label className={styles.inputGroup}>
                      <span className={styles.inputLabel}>Ordem</span>
                      <input
                        className={styles.inputControl}
                        type="number"
                        min={0}
                        value={photo.order_index ?? 0}
                        onChange={(event) => handlePhotoOrderChange(photo.id, normalizeInt(event.target.value, 0))}
                        disabled={photosLoading || isReadonly}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => handlePhotoDelete(photo.id)}
                      disabled={photosLoading || isReadonly}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>Nenhuma foto cadastrada.</div>
          )}
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Lista de opções</p>
          <h2 className={styles.sectionTitle}>Opções cadastradas</h2>
          <p className={styles.sectionDescription}>Confira os vínculos e edite conforme necessário.</p>
        </div>

        {!loading && optionsWithoutService.length ? (
          <div className={styles.helperText}>Opções sem serviço vinculado: {optionsWithoutService.map((option) => option.name).join(", ")}.</div>
        ) : null}
        {!loading && servicesWithoutOptions.length ? (
          <div className={styles.helperText}>Serviços sem opções: {servicesWithoutOptions.map((service) => service.name).join(", ")}.</div>
        ) : null}

        {loading ? (
          <div className={styles.helperText}>Carregando opções...</div>
        ) : filteredOptions.length ? (
          <div className={styles.optionGrid}>
            {filteredOptions.map((option) => (
              <div key={option.id} className={styles.optionCard}>
                <div className={styles.optionHeader}>
                  <div>
                    <h3 className={styles.optionTitle}>{option.name}</h3>
                    <p className={styles.sectionDescription}>{option.description || "Sem descrição"}</p>
                  </div>
                  <span className={`${styles.badge} ${option.active ? styles.statusActive : styles.statusInactive}`}>
                    {option.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <div className={styles.optionMeta}>
                  <span className={styles.pill}>Slug: {option.slug || "sem-slug"}</span>
                  <span className={styles.pill}>Duração: {option.duration_min} min</span>
                  <span className={styles.pill}>Preço: R$ {(option.price_cents / 100).toFixed(2)}</span>
                  <span className={styles.pill}>Sinal: R$ {(option.deposit_cents / 100).toFixed(2)}</span>
                  <span className={styles.pill}>Buffer: {option.buffer_min} min</span>
                </div>
                <div className={styles.pillGroup}>
                  {option.serviceTypeNames.length ? (
                    option.serviceTypeNames.map((serviceName) => (
                      <span key={serviceName} className={styles.pill}>
                        {serviceName}
                      </span>
                    ))
                  ) : (
                    <span className={styles.muted}>Nenhum serviço vinculado</span>
                  )}
                </div>
                <div className={styles.pillGroup}>
                  {option.categoryNames.length ? (
                    option.categoryNames.map((categoryName) => (
                      <span key={categoryName} className={styles.pillMuted}>
                        {categoryName}
                      </span>
                    ))
                  ) : (
                    <span className={styles.muted}>Sem categoria</span>
                  )}
                </div>
                <div className={styles.actions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => handleEdit(option)} disabled={saving || isReadonly}>
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>Nenhuma opção encontrada com os filtros selecionados.</div>
        )}
      </section>
    </div>
  );
}
