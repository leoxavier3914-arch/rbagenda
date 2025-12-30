/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { supabase } from "@/lib/db";
import { slugify } from "@/lib/slug";

import { resolveFinalServiceValues, type ServiceAssignmentOverride } from "@/lib/servicePricing";
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
  base_duration_min?: number | null;
  base_price_cents?: number | null;
  base_deposit_cents?: number | null;
  base_buffer_min?: number | null;
  category_name?: string | null;
  category?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
};

type ServiceAssignmentRow = {
  service_type_id?: string | null;
  use_service_defaults?: boolean | null;
  override_duration_min?: number | null;
  override_price_cents?: number | null;
  override_deposit_cents?: number | null;
  override_buffer_min?: number | null;
  service_type?: ServiceTypeOption | ServiceTypeOption[] | null;
};

type ServiceRow = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  duration_min?: number | null;
  price_cents?: number | null;
  deposit_cents?: number | null;
  buffer_min?: number | null;
  active: boolean;
  branch_id: string | null;
  assignments?: ServiceAssignmentRow[] | null;
};

type AssignmentDisplay = {
  serviceTypeId: string;
  serviceTypeName: string;
  categoryId: string | null;
  categoryName: string | null;
  useDefaults: boolean;
  overrides: ServiceAssignmentOverride;
  final: {
    duration: number;
    price: number;
    deposit: number;
    buffer: number;
  };
  active: boolean;
};

type NormalizedOption = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  active: boolean;
  branch_id: string | null;
  serviceTypeIds: string[];
  serviceTypeNames: string[];
  categoryIds: string[];
  categoryNames: string[];
  assignments: AssignmentDisplay[];
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
  active: boolean;
};

const defaultForm: OptionFormState = {
  name: "",
  slug: "",
  description: "",
  active: true,
};

const normalizeInt = (value: string | number, fallback = 0) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
};

const formatPriceLabel = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

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

    const [categoriesResponse, serviceTypesResponse, optionsResponse] = await Promise.all([
      supabase
        .from("service_categories")
        .select("id, name, active, order_index")
        .order("order_index", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true }),
      supabase
        .from("service_types")
        .select(
          "id, name, active, category_id, order_index, base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min, category:service_categories(id, name)"
        )
        .order("order_index", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true }),
      supabase
        .from("services")
        .select(
          "id, name, slug, description, duration_min, price_cents, deposit_cents, buffer_min, active, branch_id, assignments:service_type_assignments(service_type_id, use_service_defaults, override_duration_min, override_price_cents, override_deposit_cents, override_buffer_min, service_type:service_types(id, name, active, category_id, base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min, category:service_categories(id, name)))"
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
        base_duration_min: entry.base_duration_min ?? 0,
        base_price_cents: entry.base_price_cents ?? 0,
        base_deposit_cents: entry.base_deposit_cents ?? 0,
        base_buffer_min: entry.base_buffer_min ?? 0,
      })) ?? [];

    const normalizedOptions =
      (optionsResponse.data ?? []).map((entry: ServiceRow) => {
        const assignmentEntries = (entry.assignments ?? []).flatMap((assignment) => {
          const serviceType = toArray(assignment?.service_type).find((service) => service && typeof service === "object");
          if (!serviceType?.id) return [];

          const overrides: ServiceAssignmentOverride = {
            use_service_defaults: assignment?.use_service_defaults ?? true,
            override_duration_min: assignment?.override_duration_min ?? null,
            override_price_cents: assignment?.override_price_cents ?? null,
            override_deposit_cents: assignment?.override_deposit_cents ?? null,
            override_buffer_min: assignment?.override_buffer_min ?? null,
          };

          const finalValues = resolveFinalServiceValues(
            {
              base_duration_min: serviceType.base_duration_min ?? 0,
              base_price_cents: serviceType.base_price_cents ?? 0,
              base_deposit_cents: serviceType.base_deposit_cents ?? 0,
              base_buffer_min: serviceType.base_buffer_min ?? 0,
            },
            overrides
          );

          const { id: catId, name: catName } = resolveCategoryMeta(serviceType);

          return [
            {
              serviceTypeId: serviceType.id,
              serviceTypeName: serviceType.name ?? "Serviço",
              categoryName: catName ?? null,
              useDefaults: overrides.use_service_defaults !== false,
              overrides,
              final: {
                duration: finalValues.duration_min,
                price: finalValues.price_cents,
                deposit: finalValues.deposit_cents,
                buffer: finalValues.buffer_min,
              },
              active: serviceType.active !== false,
              categoryId: catId ?? null,
            },
          ] as AssignmentDisplay[];
        });

        const uniqueServiceTypes = new Map<string, AssignmentDisplay>();
        assignmentEntries.forEach((assignment) => {
          if (!assignment.serviceTypeId || uniqueServiceTypes.has(assignment.serviceTypeId)) return;
          uniqueServiceTypes.set(assignment.serviceTypeId, assignment);
        });

        const categoryNames = new Map<string, string>();
        Array.from(uniqueServiceTypes.values()).forEach((assignment) => {
          if (assignment.categoryName && assignment.categoryId) {
            categoryNames.set(assignment.categoryId, assignment.categoryName);
          }
        });

        return {
          id: entry.id,
          name: entry.name ?? "Opção",
          slug: entry.slug ?? null,
          description: entry.description ?? null,
          active: entry.active !== false,
          branch_id: entry.branch_id ?? null,
          serviceTypeIds: Array.from(uniqueServiceTypes.keys()),
          serviceTypeNames: Array.from(uniqueServiceTypes.values()).map((item) => item.serviceTypeName ?? "Serviço"),
          categoryIds: Array.from(categoryNames.keys()),
          categoryNames: Array.from(categoryNames.values()),
          assignments: Array.from(uniqueServiceTypes.values()),
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
    setPhotos([]);
  };

  const handleEdit = (option: NormalizedOption) => {
    setEditingId(option.id);
    setForm({
      name: option.name ?? "",
      slug: option.slug ?? "",
      description: option.description ?? "",
      active: option.active !== false,
    });
    setNote("Editando opção. Salve para confirmar ou cancele para limpar.");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSuper) {
      setError("Apenas Master ou Super podem editar opções.");
      return;
    }

    if (!editingId) {
      setError('Opções devem ser criadas dentro de um Serviço. Use "Gerenciar opções" em /admin/servicos.');
      setNote(null);
      return;
    }

    setSaving(true);
    setError(null);
    setNote(null);

    const payload = {
      name: form.name.trim() || "Opção",
      slug: normalizeSlug(form.slug, form.name),
      description: form.description.trim() || null,
      active: Boolean(form.active),
    };

    const response = await supabase.from("services").update(payload).eq("id", editingId);

    if (response.error) {
      setError("Não foi possível salvar a opção. Verifique os campos e tente novamente.");
    } else {
      setNote("Opção atualizada.");
      resetForm();
      void loadData();
    }

    setSaving(false);
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
  const currentOption = useMemo(() => options.find((option) => option.id === editingId) ?? null, [editingId, options]);

  return (
    <div className={styles.page}>
      <section className={styles.headerCard}>
        <h1 className={styles.headerTitle}>Opções</h1>
        <p className={styles.headerDescription}>
          Catálogo de opções (services). Aqui você edita dados básicos e vê em quais serviços cada opção está vinculada. Criação e
          vínculos acontecem dentro de Serviços.
        </p>
        <div className={styles.tagRow}>
          <span className={styles.tag}>Catálogo de opções</span>
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
          <p className={styles.sectionEyebrow}>{editingId ? "Editar opção" : "Catálogo"}</p>
          <h2 className={styles.sectionTitle}>{editingId ? "Atualize a opção selecionada" : "Selecione uma opção para editar"}</h2>
          <p className={styles.sectionDescription}>
            Esta página é o catálogo de opções. Criação e vínculos acontecem dentro de Serviços. Aqui você pode editar nome, slug,
            descrição, status e fotos.
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
          <p className={styles.helperText}>
            Para criar novas opções, use a ação &ldquo;Gerenciar opções&rdquo; dentro de um Serviço. Esta tela impede criar opções sem
            vínculo.
          </p>
          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryButton} disabled={saving || isReadonly}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            {editingId ? (
              <button type="button" className={styles.secondaryButton} onClick={resetForm} disabled={saving}>
                Cancelar
              </button>
            ) : null}
            <Link href="/admin/servicos" className={styles.secondaryButton}>
              Ir para Serviços
            </Link>
          </div>
        </form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Vínculos</p>
          <h2 className={styles.sectionTitle}>Onde esta opção está vinculada?</h2>
          <p className={styles.sectionDescription}>
            Visualize os serviços associados. Para criar, remover vínculos ou personalizar valores, use o botão &ldquo;Gerenciar opções&rdquo;
            dentro de Serviços.
          </p>
        </div>
        {editingId ? (
          currentOption && currentOption.assignments.length ? (
            <div className={styles.optionGrid}>
              {currentOption.assignments.map((assignment) => (
                <div key={`${currentOption.id}-${assignment.serviceTypeId}`} className={styles.optionCard}>
                  <div className={styles.optionHeader}>
                    <div>
                      <h3 className={styles.optionTitle}>{assignment.serviceTypeName}</h3>
                      <p className={styles.sectionDescription}>{assignment.categoryName || "Sem categoria"}</p>
                    </div>
                    <span className={`${styles.badge} ${assignment.useDefaults ? styles.statusActive : styles.statusInactive}`}>
                      {assignment.useDefaults ? "Padrão do serviço" : "Personalizado"}
                    </span>
                  </div>
                  <div className={styles.pillGroup}>
                    <span className={styles.pill}>
                      Final: {assignment.final.duration} min • {formatPriceLabel(assignment.final.price)} • Sinal{" "}
                      {formatPriceLabel(assignment.final.deposit)} • Buffer {assignment.final.buffer} min
                    </span>
                    <span className={styles.pillMuted}>
                      {assignment.useDefaults ? "Herdando valores do serviço" : "Override salvo na combinação"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.helperText}>Nenhum vínculo ativo para esta opção. Ajuste dentro do Serviço correspondente.</div>
          )
        ) : (
          <div className={styles.helperText}>Selecione uma opção para ver onde ela está vinculada.</div>
        )}
        <div className={styles.buttonRow}>
          <Link href="/admin/servicos" className={styles.secondaryButton}>
            Gerenciar vínculos nos Serviços
          </Link>
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
          <p className={styles.sectionDescription}>
            Catálogo completo de opções. Para criar ou alterar vínculos, use &ldquo;Gerenciar opções&rdquo; dentro de Serviços.
          </p>
        </div>

        {!loading && optionsWithoutService.length ? (
          <div className={styles.helperText}>
            Opções sem serviço vinculado: {optionsWithoutService.map((option) => option.name).join(", ")}. Resolva em Serviços &rarr;
            Gerenciar opções.
          </div>
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
                <div className={styles.pillGroup}>
                  <span className={styles.pill}>Slug: {option.slug || "sem-slug"}</span>
                  <span className={styles.pill}>
                    {option.assignments.length} {option.assignments.length === 1 ? "serviço" : "serviços"}
                  </span>
                </div>
                <div className={styles.pillGroup}>
                  {option.assignments.length ? (
                    option.assignments.map((assignment) => (
                      <span key={`${option.id}-${assignment.serviceTypeId}`} className={styles.pill}>
                        {assignment.serviceTypeName}: {assignment.useDefaults ? "Padrão" : "Personalizado"} • {assignment.final.duration} min •{" "}
                        {formatPriceLabel(assignment.final.price)} • Sinal {formatPriceLabel(assignment.final.deposit)} • Buffer {assignment.final.buffer} min
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
