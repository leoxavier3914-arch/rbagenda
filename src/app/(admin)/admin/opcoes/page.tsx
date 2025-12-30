/* eslint-disable @next/next/no-img-element */
"use client";

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

const formatMoneyInput = (cents: number | null | undefined) => {
  const safeValue = Math.max(0, Number.isFinite(cents ?? 0) ? Number(cents) : 0);
  return (safeValue / 100).toFixed(2);
};

const parseReaisToCents = (value: string | number | null | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, ".");
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed * 100));
  }
  return 0;
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
  const [viewMode, setViewMode] = useState<"list" | "form" | "personalize">("list");
  const [form, setForm] = useState<OptionFormState>(defaultForm);
  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<Set<string>>(new Set());
  const [assignmentForm, setAssignmentForm] = useState<Map<
    string,
    { useDefaults: boolean; duration: string; price: string; deposit: string; buffer: string }
  >>(new Map());
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterServiceType, setFilterServiceType] = useState<string>(initialServiceFilter);
  const [onlyActive, setOnlyActive] = useState<boolean>(true);
  const [serviceSearch, setServiceSearch] = useState<string>("");
  const [serviceSelectionCategory, setServiceSelectionCategory] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<ServicePhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [photosNote, setPhotosNote] = useState<string | null>(null);

  const isSuper = role === "adminsuper" || role === "adminmaster";
  const isReadonly = role === "admin";
  const defaultAssignmentConfig = { useDefaults: true, duration: "", price: "", deposit: "", buffer: "" };

  const getAssignmentConfig = (serviceTypeId: string) => assignmentForm.get(serviceTypeId) ?? defaultAssignmentConfig;

  const updateAssignmentConfig = (
    serviceTypeId: string,
    updater: (config: { useDefaults: boolean; duration: string; price: string; deposit: string; buffer: string }) => {
      useDefaults: boolean;
      duration: string;
      price: string;
      deposit: string;
      buffer: string;
    }
  ) => {
    setAssignmentForm((prev) => {
      const next = new Map(prev);
      const current = prev.get(serviceTypeId) ?? defaultAssignmentConfig;
      next.set(serviceTypeId, updater(current));
      return next;
    });
  };

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
    setSelectedServiceTypeIds(new Set());
    setPhotos([]);
    setAssignmentForm(new Map());
    setServiceSearch("");
    setServiceSelectionCategory("");
    setSelectionError(null);
    setError(null);
    setNote(null);
  };

  const handleEdit = (option: NormalizedOption) => {
    setEditingId(option.id);
    setForm({
      name: option.name ?? "",
      slug: option.slug ?? "",
      description: option.description ?? "",
      active: option.active !== false,
    });
    setSelectedServiceTypeIds(new Set(option.serviceTypeIds));
    const nextAssignments = new Map<
      string,
      { useDefaults: boolean; duration: string; price: string; deposit: string; buffer: string }
    >();
    option.assignments.forEach((assignment) => {
      nextAssignments.set(assignment.serviceTypeId, {
        useDefaults: assignment.useDefaults,
        duration: assignment.overrides.override_duration_min !== null && assignment.overrides.override_duration_min !== undefined
          ? String(assignment.overrides.override_duration_min)
          : "",
        price: assignment.overrides.override_price_cents !== null && assignment.overrides.override_price_cents !== undefined
          ? formatMoneyInput(assignment.overrides.override_price_cents)
          : "",
        deposit:
          assignment.overrides.override_deposit_cents !== null && assignment.overrides.override_deposit_cents !== undefined
            ? formatMoneyInput(assignment.overrides.override_deposit_cents)
            : "",
        buffer: assignment.overrides.override_buffer_min !== null && assignment.overrides.override_buffer_min !== undefined
          ? String(assignment.overrides.override_buffer_min)
          : "",
      });
    });
    setAssignmentForm(nextAssignments);
    setSelectionError(null);
    setNote("Editando opção. Salve para confirmar ou cancele para limpar.");
  };

  const startCreate = () => {
    resetForm();
    setViewMode("form");
    setNote("Preencha os dados e escolha os serviços obrigatórios na mesma tela.");
  };

  const startEdit = (option: NormalizedOption, mode: "form" | "personalize" = "form") => {
    handleEdit(option);
    setViewMode(mode);
    setNote(mode === "personalize" ? "Personalize os vínculos por serviço e salve para aplicar." : "Editando opção. Salve ou volte para cancelar.");
  };

  const backToList = () => {
    resetForm();
    setViewMode("list");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSuper) {
      setError("Apenas Master ou Super podem editar opções.");
      return;
    }

    if (selectedServiceTypeIds.size === 0) {
      setError("Selecione pelo menos 1 serviço para esta opção.");
      setSelectionError("Selecione pelo menos 1 serviço para esta opção.");
      return;
    }

    setSaving(true);
    setError(null);
    setNote(null);
    setSelectionError(null);

    const desiredAssignments = Array.from(selectedServiceTypeIds);
    const primaryServiceType = desiredAssignments.length
      ? serviceTypes.find((serviceType) => serviceType.id === desiredAssignments[0])
      : null;

    const existingOption = editingId ? options.find((option) => option.id === editingId) : null;
    const legacyDuration = Math.max(
      1,
      normalizeInt(existingOption?.assignments[0]?.final.duration ?? primaryServiceType?.base_duration_min ?? 30, 30)
    );
    const legacyPrice = Math.max(
      0,
      normalizeInt(existingOption?.assignments[0]?.final.price ?? primaryServiceType?.base_price_cents ?? 0, 0)
    );
    const legacyDepositRaw = Math.max(
      0,
      normalizeInt(existingOption?.assignments[0]?.final.deposit ?? primaryServiceType?.base_deposit_cents ?? 0, 0)
    );
    const legacyDeposit = Math.min(legacyPrice, legacyDepositRaw);
    const legacyBuffer = Math.max(
      0,
      normalizeInt(existingOption?.assignments[0]?.final.buffer ?? primaryServiceType?.base_buffer_min ?? 0, 0)
    );

    const payload = {
      name: form.name.trim() || "Opção",
      slug: normalizeSlug(form.slug, form.name),
      description: form.description.trim() || null,
      duration_min: legacyDuration,
      price_cents: legacyPrice,
      deposit_cents: legacyDeposit,
      buffer_min: legacyBuffer,
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

    const assignmentError = await syncAssignments(targetId, previousAssignments, desiredAssignments);
    if (assignmentError) {
      setError(assignmentError);
      setSaving(false);
      return;
    }

    resetForm();
    setNote(editingId ? "Opção atualizada." : "Opção criada.");
    void loadData();
    setViewMode("list");
    setSaving(false);
  };

  const handleDelete = async (option: NormalizedOption) => {
    if (!isSuper) {
      setError("Apenas Master ou Super podem excluir opções.");
      return;
    }

    const confirmed = window.confirm(`Deseja remover a opção “${option.name}”?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setNote(null);

    const { error: assignmentsError } = await supabase.from("service_type_assignments").delete().eq("service_id", option.id);
    if (assignmentsError) {
      setError("Não foi possível remover os vínculos da opção.");
      setSaving(false);
      return;
    }

    await supabase.from("service_photos").delete().eq("service_id", option.id);

    const { error: deleteError } = await supabase.from("services").delete().eq("id", option.id);
    if (deleteError) {
      setError("Não foi possível excluir a opção.");
      setSaving(false);
      return;
    }

    await loadData();
    backToList();
    setNote("Opção excluída.");
    setSaving(false);
  };

  const buildAssignmentPayload = (serviceId: string, serviceTypeId: string) => {
    const base = serviceTypes.find((serviceType) => serviceType.id === serviceTypeId);
    const config = assignmentForm.get(serviceTypeId);
    const useDefaults = config?.useDefaults !== false;

    if (useDefaults) {
      return {
        service_id: serviceId,
        service_type_id: serviceTypeId,
        use_service_defaults: true,
        override_duration_min: null,
        override_price_cents: null,
        override_deposit_cents: null,
        override_buffer_min: null,
      };
    }

    const basePrice = Math.max(0, Math.round(base?.base_price_cents ?? 0));
    const priceOverride = config?.price ? parseReaisToCents(config.price) : null;
    const depositOverrideRaw = config?.deposit ? parseReaisToCents(config.deposit) : null;
    const depositLimit = priceOverride ?? basePrice;
    const depositOverride =
      depositOverrideRaw !== null && depositOverrideRaw !== undefined && Number.isFinite(depositOverrideRaw)
        ? Math.min(depositLimit, depositOverrideRaw)
        : null;

    return {
      service_id: serviceId,
      service_type_id: serviceTypeId,
      use_service_defaults: false,
      override_duration_min:
        config?.duration && config.duration.length > 0 ? normalizeInt(config.duration, base?.base_duration_min ?? 0) : null,
      override_price_cents: priceOverride,
      override_deposit_cents: depositOverride,
      override_buffer_min:
        config?.buffer && config.buffer.length > 0 ? normalizeInt(config.buffer, base?.base_buffer_min ?? 0) : null,
    };
  };

  const syncAssignments = async (serviceId: string, existing: string[], desired: string[]) => {
    const toAdd = desired.filter((id) => !existing.includes(id));
    const toRemove = existing.filter((id) => !desired.includes(id));

    if (toAdd.length) {
      const { error } = await supabase
        .from("service_type_assignments")
        .upsert(toAdd.map((serviceTypeId) => buildAssignmentPayload(serviceId, serviceTypeId)), { onConflict: "service_id,service_type_id" });
      if (error) return "Não foi possível vincular todos os serviços à opção.";
    }

    const staying = desired.filter((id) => existing.includes(id));
    if (staying.length) {
      const { error } = await supabase
        .from("service_type_assignments")
        .upsert(staying.map((serviceTypeId) => buildAssignmentPayload(serviceId, serviceTypeId)), { onConflict: "service_id,service_type_id" });
      if (error) return "Não foi possível salvar as personalizações de algumas combinações.";
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
  const categoryOrder = useMemo(() => {
    const order = new Map<string, number>();
    categories.forEach((category, index) => {
      order.set(category.id, index);
    });
    return order;
  }, [categories]);
  const filteredServiceTypes = useMemo(() => {
    const normalizedSearch = serviceSearch.trim().toLowerCase();
    return serviceTypes
      .filter((serviceType) => {
        const matchesSearch = normalizedSearch.length
          ? serviceType.name.toLowerCase().includes(normalizedSearch)
          : true;
        const categoryMeta = resolveCategoryMeta(serviceType);
        const matchesCategory = serviceSelectionCategory
          ? categoryMeta.id === serviceSelectionCategory
          : true;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [serviceSearch, serviceSelectionCategory, serviceTypes]);
  const groupedServiceTypes = useMemo(() => {
    const groups = new Map<
      string,
      { id: string | null; name: string; services: ServiceTypeOption[] }
    >();

    filteredServiceTypes.forEach((serviceType) => {
      const categoryMeta = resolveCategoryMeta(serviceType);
      const key = categoryMeta.id ?? "sem-categoria";
      const group = groups.get(key) ?? {
        id: categoryMeta.id ?? null,
        name: categoryMeta.name ?? "Sem categoria",
        services: [],
      };
      group.services.push(serviceType);
      groups.set(key, group);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const baseOrder = categories.length;
      const orderA = a.id ? categoryOrder.get(a.id) ?? baseOrder + 1 : baseOrder + 2;
      const orderB = b.id ? categoryOrder.get(b.id) ?? baseOrder + 1 : baseOrder + 2;
      if (orderA === orderB) return a.name.localeCompare(b.name, "pt-BR");
      return orderA - orderB;
    });
  }, [categories, categoryOrder, filteredServiceTypes]);
  const selectedServiceTypes = useMemo(
    () => serviceTypes.filter((serviceType) => selectedServiceTypeIds.has(serviceType.id)),
    [selectedServiceTypeIds, serviceTypes]
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

      {viewMode === "list" ? (
        <section className={styles.section}>
          <div className={styles.sectionTopBar}>
            <div>
              <p className={styles.sectionEyebrow}>Lista de opções</p>
              <h2 className={styles.sectionTitle}>Opções cadastradas</h2>
              <p className={styles.sectionDescription}>Filtre, edite, personalize ou crie novas opções sem sair desta tela.</p>
            </div>
            <button type="button" className={styles.primaryButton} onClick={startCreate} disabled={saving || isReadonly}>
              Nova opção
            </button>
          </div>

          {note ? <div className={styles.helperText}>{note}</div> : null}
          {error ? <div className={`${styles.helperText} ${styles.errorText}`}>{error}</div> : null}

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
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => startEdit(option, "form")}
                      disabled={saving || isReadonly}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => startEdit(option, "personalize")}
                      disabled={saving || isReadonly}
                    >
                      Personalizar
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => handleDelete(option)}
                      disabled={saving || isReadonly}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>Nenhuma opção encontrada com os filtros selecionados.</div>
          )}
        </section>
      ) : (
        <form className={styles.formStack} onSubmit={handleSubmit}>
          <section className={`${styles.section} ${styles.formSection}`}>
            <div className={styles.sectionTopBar}>
              <div>
                <p className={styles.sectionEyebrow}>
                  {editingId ? (viewMode === "personalize" ? "Personalizar opção" : "Editar opção") : "Nova opção"}
                </p>
                <h2 className={styles.sectionTitle}>
                  {editingId ? (viewMode === "personalize" ? "Configuração por serviço" : "Atualize uma opção existente") : "Cadastre uma opção"}
                </h2>
                <p className={styles.sectionDescription}>
                  Defina nome, slug e vínculos. Os campos de serviço e personalização ficam no mesmo cartão, junto ao botão de salvar.
                </p>
                {note ? <div className={styles.helperText}>{note}</div> : null}
                {error ? <div className={`${styles.helperText} ${styles.errorText}`}>{error}</div> : null}
              </div>
              <button type="button" className={styles.secondaryButton} onClick={backToList} disabled={saving}>
                Voltar para a lista
              </button>
            </div>

            <div className={styles.formGrid}>
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
            </div>

            <div className={styles.divider} />

            <div className={styles.inlineHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Serviços obrigatórios</p>
                <h3 className={styles.sectionTitle}>Selecione onde esta opção aparece</h3>
                <p className={styles.sectionDescription}>
                  Escolha os serviços no mesmo fluxo do formulário. Uma opção precisa estar vinculada a pelo menos um serviço.
                </p>
              </div>
              <div className={styles.inlineInfo}>
                <span className={styles.inputLabel}>Selecionados</span>
                <span className={styles.pill}>{selectedServiceTypeIds.size}</span>
              </div>
            </div>

            <div className={styles.serviceToolbar}>
              <label className={styles.inputGroup}>
                <span className={styles.inputLabel}>Buscar serviço</span>
                <input
                  className={styles.inputControl}
                  value={serviceSearch}
                  onChange={(event) => setServiceSearch(event.target.value)}
                  placeholder="Digite o nome do serviço"
                  disabled={saving || isReadonly}
                />
              </label>
              <label className={styles.inputGroup}>
                <span className={styles.inputLabel}>Filtrar por categoria</span>
                <select
                  className={styles.selectControl}
                  value={serviceSelectionCategory}
                  onChange={(event) => setServiceSelectionCategory(event.target.value)}
                  disabled={saving || isReadonly}
                >
                  <option value="">Todas</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectionError ? <div className={`${styles.helperText} ${styles.errorText}`}>{selectionError}</div> : null}

            <div className={styles.serviceList}>
              {groupedServiceTypes.length ? (
                groupedServiceTypes.map((group) => (
                  <div key={group.id ?? "sem-categoria"} className={styles.serviceGroup}>
                    <div className={styles.serviceGroupTitle}>
                      <div>
                        <p className={styles.sectionEyebrow}>{group.name}</p>
                        <p className={styles.sectionDescription}>{group.id ? "Categoria ativa" : "Sem categoria"}</p>
                      </div>
                      <span className={styles.pill}>{group.services.length} serviços</span>
                    </div>
                    <div className={styles.serviceGrid}>
                      {group.services.map((service) => (
                        <label
                          key={service.id}
                          className={`${styles.serviceRow} ${selectedServiceTypeIds.has(service.id) ? styles.serviceRowActive : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedServiceTypeIds.has(service.id)}
                            onChange={(event) => {
                              setSelectedServiceTypeIds((prev) => {
                                const next = new Set(prev);
                                if (event.target.checked) {
                                  next.add(service.id);
                                  setAssignmentForm((prevMap) => {
                                    if (prevMap.has(service.id)) return prevMap;
                                    const nextMap = new Map(prevMap);
                                    nextMap.set(service.id, defaultAssignmentConfig);
                                    return nextMap;
                                  });
                                } else {
                                  next.delete(service.id);
                                  setAssignmentForm((prevMap) => {
                                    const nextMap = new Map(prevMap);
                                    nextMap.delete(service.id);
                                    return nextMap;
                                  });
                                }
                                setSelectionError(next.size ? null : "Selecione pelo menos 1 serviço para esta opção.");
                                return next;
                              });
                            }}
                            disabled={saving || isReadonly}
                          />
                          <div className={styles.serviceRowBody}>
                            <div className={styles.serviceRowHeader}>
                              <span className={styles.serviceName}>{service.name}</span>
                              <span className={`${styles.badge} ${service.active !== false ? styles.statusActive : styles.statusInactive}`}>
                                {service.active !== false ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                            <p className={styles.serviceMeta}>
                              {resolveCategoryMeta(service).name ?? "Sem categoria"} • {service.base_duration_min ?? 0} min •{" "}
                              {formatPriceLabel(service.base_price_cents ?? 0)}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.helperText}>Nenhum serviço encontrado com os filtros informados.</div>
              )}
            </div>

            <div className={styles.divider} />

            <div className={styles.inlineHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Configuração por serviço</p>
                <h3 className={styles.sectionTitle}>Personalize onde for necessário</h3>
                <p className={styles.sectionDescription}>
                  Para cada serviço selecionado, mantenha o padrão ou personalize tempo, preço, sinal e buffer. Salvando, os valores são gravados em
                  service_type_assignments.
                </p>
              </div>
            </div>

            {selectedServiceTypes.length === 0 ? (
              <div className={styles.helperText}>Selecione ao menos um serviço para personalizar.</div>
            ) : (
              <div className={styles.optionGrid}>
                {selectedServiceTypes.map((serviceType) => {
                  const config = getAssignmentConfig(serviceType.id);
                  const overridePayload: ServiceAssignmentOverride = {
                    use_service_defaults: config.useDefaults,
                    override_duration_min:
                      !config.useDefaults && config.duration.length > 0
                        ? normalizeInt(config.duration, serviceType.base_duration_min ?? 0)
                        : null,
                    override_price_cents:
                      !config.useDefaults && config.price.length > 0 ? parseReaisToCents(config.price) : null,
                    override_deposit_cents:
                      !config.useDefaults && config.deposit.length > 0 ? parseReaisToCents(config.deposit) : null,
                    override_buffer_min:
                      !config.useDefaults && config.buffer.length > 0
                        ? normalizeInt(config.buffer, serviceType.base_buffer_min ?? 0)
                        : null,
                  };
                  const finalValues = resolveFinalServiceValues(
                    {
                      base_duration_min: serviceType.base_duration_min ?? 0,
                      base_price_cents: serviceType.base_price_cents ?? 0,
                      base_deposit_cents: serviceType.base_deposit_cents ?? 0,
                      base_buffer_min: serviceType.base_buffer_min ?? 0,
                    },
                    overridePayload
                  );
                  const defaultValues = resolveFinalServiceValues(
                    {
                      base_duration_min: serviceType.base_duration_min ?? 0,
                      base_price_cents: serviceType.base_price_cents ?? 0,
                      base_deposit_cents: serviceType.base_deposit_cents ?? 0,
                      base_buffer_min: serviceType.base_buffer_min ?? 0,
                    },
                    { use_service_defaults: true }
                  );

                  return (
                    <div key={serviceType.id} className={styles.optionCard}>
                      <div className={styles.optionHeader}>
                        <div>
                          <h3 className={styles.optionTitle}>{serviceType.name}</h3>
                          <p className={styles.sectionDescription}>{serviceType.category_name || "Sem categoria"}</p>
                        </div>
                        <label className={`${styles.inputGroup} ${styles.toggleRow}`}>
                          <input
                            type="checkbox"
                            checked={config.useDefaults}
                            onChange={(event) =>
                              updateAssignmentConfig(serviceType.id, (prev) => ({
                                ...prev,
                                useDefaults: event.target.checked,
                                duration: event.target.checked ? "" : prev.duration,
                                price: event.target.checked ? "" : prev.price,
                                deposit: event.target.checked ? "" : prev.deposit,
                                buffer: event.target.checked ? "" : prev.buffer,
                              }))
                            }
                            disabled={saving || isReadonly}
                          />
                          <span className={styles.inputLabel}>Usar padrão do serviço</span>
                        </label>
                      </div>

                      {!config.useDefaults ? (
                        <div className={styles.formGrid}>
                          <label className={styles.inputGroup}>
                            <span className={styles.inputLabel}>Tempo final (min)</span>
                            <input
                              className={styles.inputControl}
                              type="number"
                              min={0}
                              value={config.duration}
                              onChange={(event) =>
                                updateAssignmentConfig(serviceType.id, (prev) => ({
                                  ...prev,
                                  duration: event.target.value,
                                }))
                              }
                              disabled={saving || isReadonly}
                            />
                          </label>
                          <label className={styles.inputGroup}>
                            <span className={styles.inputLabel}>Preço final (R$)</span>
                            <input
                              className={styles.inputControl}
                              type="number"
                              min={0}
                              step="0.01"
                              value={config.price}
                              onChange={(event) =>
                                updateAssignmentConfig(serviceType.id, (prev) => ({
                                  ...prev,
                                  price: event.target.value,
                                }))
                              }
                              disabled={saving || isReadonly}
                            />
                          </label>
                          <label className={styles.inputGroup}>
                            <span className={styles.inputLabel}>Sinal final (R$)</span>
                            <input
                              className={styles.inputControl}
                              type="number"
                              min={0}
                              step="0.01"
                              value={config.deposit}
                              onChange={(event) =>
                                updateAssignmentConfig(serviceType.id, (prev) => ({
                                  ...prev,
                                  deposit: event.target.value,
                                }))
                              }
                              disabled={saving || isReadonly}
                            />
                            <p className={styles.helperText}>Se vazio, herda o sinal padrão.</p>
                          </label>
                          <label className={styles.inputGroup}>
                            <span className={styles.inputLabel}>Buffer final (min)</span>
                            <input
                              className={styles.inputControl}
                              type="number"
                              min={0}
                              value={config.buffer}
                              onChange={(event) =>
                                updateAssignmentConfig(serviceType.id, (prev) => ({
                                  ...prev,
                                  buffer: event.target.value,
                                }))
                              }
                              disabled={saving || isReadonly}
                            />
                            <p className={styles.helperText}>Se vazio, herda o buffer padrão.</p>
                          </label>
                        </div>
                      ) : null}

                      <div className={styles.pillGroup}>
                        <span className={styles.pill}>
                          Padrão do serviço: {defaultValues.duration_min} min • {formatPriceLabel(defaultValues.price_cents)} • Sinal{" "}
                          {formatPriceLabel(defaultValues.deposit_cents)} • Buffer {defaultValues.buffer_min} min
                        </span>
                      </div>
                      <div className={styles.pillGroup}>
                        <span className={styles.pill}>
                          Final: {finalValues.duration_min} min • {formatPriceLabel(finalValues.price_cents)} • Sinal{" "}
                          {formatPriceLabel(finalValues.deposit_cents)} • Buffer {finalValues.buffer_min} min
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.actionsSection}>
              <div className={styles.buttonRow}>
                <button type="submit" className={styles.primaryButton} disabled={saving || isReadonly}>
                  {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar opção"}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={backToList} disabled={saving}>
                  Cancelar
                </button>
              </div>
              <p className={styles.helperText}>Salvar aplica o vínculo obrigatório e as personalizações em um único envio.</p>
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
        </form>
      )}
    </div>
  );
}
