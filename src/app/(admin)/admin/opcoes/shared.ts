import { supabase } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { resolveFinalServiceValues, type ServiceAssignmentOverride } from "@/lib/servicePricing";

export type CategoryOption = {
  id: string;
  name: string;
  active: boolean;
  order_index: number;
};

export type ServiceTypeOption = {
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

export type ServiceAssignmentRow = {
  service_type_id?: string | null;
  use_service_defaults?: boolean | null;
  override_duration_min?: number | null;
  override_price_cents?: number | null;
  override_deposit_cents?: number | null;
  override_buffer_min?: number | null;
  service_type?: ServiceTypeOption | ServiceTypeOption[] | null;
};

export type ServiceRow = {
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

export type AssignmentDisplay = {
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

export type NormalizedOption = {
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

export type ServicePhoto = {
  id: string;
  url: string | null;
  order_index: number | null;
  created_at: string | null;
};

type CategoryRow = {
  id: string;
  name?: string | null;
  active?: boolean | null;
  order_index?: number | null;
};

type ServiceTypeRow = {
  id: string;
  name?: string | null;
  active?: boolean | null;
  category_id?: string | null;
  category_name?: string | null;
  category?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
  base_duration_min?: number | null;
  base_price_cents?: number | null;
  base_deposit_cents?: number | null;
  base_buffer_min?: number | null;
};

export type OptionFormState = {
  name: string;
  slug: string;
  description: string;
  active: boolean;
};

export type AssignmentConfig = {
  useDefaults: boolean;
  duration: string;
  price: string;
  deposit: string;
  buffer: string;
};

export const defaultOptionForm: OptionFormState = {
  name: "",
  slug: "",
  description: "",
  active: true,
};

export const defaultAssignmentConfig: AssignmentConfig = {
  useDefaults: true,
  duration: "",
  price: "",
  deposit: "",
  buffer: "",
};

export const normalizeInt = (value: string | number, fallback = 0) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
};

export const formatMoneyInput = (cents: number | null | undefined) => {
  const safeValue = Math.max(0, Number.isFinite(cents ?? 0) ? Number(cents) : 0);
  return (safeValue / 100).toFixed(2);
};

export const parseReaisToCents = (value: string | number | null | undefined) => {
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

export const formatPriceLabel = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

export const normalizeSlug = (value: string, fallback: string) => {
  const base = value?.trim().length ? value : fallback;
  return slugify(base || "opcao");
};

export const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

export const resolveCategoryMeta = (serviceType: ServiceTypeOption) => {
  const categoryEntry = toArray(serviceType.category).find((category) => category && typeof category === "object");
  return {
    id: serviceType.category_id ?? categoryEntry?.id ?? null,
    name: serviceType.category_name ?? categoryEntry?.name ?? null,
  };
};

export const buildAssignmentPayload = (
  serviceId: string,
  serviceTypeId: string,
  serviceTypes: ServiceTypeOption[],
  assignmentForm: Map<string, AssignmentConfig>
) => {
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

const normalizeCategories = (entries: CategoryRow[]): CategoryOption[] =>
  entries.map((category) => ({
    id: category.id,
    name: category.name ?? "Categoria",
    active: category.active !== false,
    order_index: normalizeInt(category.order_index ?? 0),
  }));

const normalizeServiceTypes = (entries: ServiceTypeRow[]): ServiceTypeOption[] =>
  entries.map((entry) => ({
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
  }));

export const normalizeAssignments = (assignments: ServiceAssignmentRow[]): AssignmentDisplay[] => {
  return assignments.flatMap((assignment) => {
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
};

export const normalizeOptions = (entries: ServiceRow[]): NormalizedOption[] => {
  return entries.map((entry) => {
    const assignmentEntries = normalizeAssignments(entry.assignments ?? []);

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
  });
};

export const mapAssignmentFormFromDisplays = (assignments: AssignmentDisplay[]) => {
  const map = new Map<string, AssignmentConfig>();
  assignments.forEach((assignment) => {
    map.set(assignment.serviceTypeId, {
      useDefaults: assignment.useDefaults,
      duration:
        assignment.overrides.override_duration_min !== null && assignment.overrides.override_duration_min !== undefined
          ? String(assignment.overrides.override_duration_min)
          : "",
      price:
        assignment.overrides.override_price_cents !== null && assignment.overrides.override_price_cents !== undefined
          ? formatMoneyInput(assignment.overrides.override_price_cents)
          : "",
      deposit:
        assignment.overrides.override_deposit_cents !== null && assignment.overrides.override_deposit_cents !== undefined
          ? formatMoneyInput(assignment.overrides.override_deposit_cents)
          : "",
      buffer:
        assignment.overrides.override_buffer_min !== null && assignment.overrides.override_buffer_min !== undefined
          ? String(assignment.overrides.override_buffer_min)
          : "",
    });
  });
  return map;
};

export const syncAssignments = async (
  serviceId: string,
  existing: string[],
  desired: string[],
  serviceTypes: ServiceTypeOption[],
  assignmentForm: Map<string, AssignmentConfig>
) => {
  const toAdd = desired.filter((id) => !existing.includes(id));
  const toRemove = existing.filter((id) => !desired.includes(id));

  if (toAdd.length) {
    const { error } = await supabase
      .from("service_type_assignments")
      .upsert(toAdd.map((serviceTypeId) => buildAssignmentPayload(serviceId, serviceTypeId, serviceTypes, assignmentForm)), {
        onConflict: "service_id,service_type_id",
      });
    if (error) return "Não foi possível vincular todos os serviços à opção.";
  }

  const staying = desired.filter((id) => existing.includes(id));
  if (staying.length) {
    const { error } = await supabase
      .from("service_type_assignments")
      .upsert(staying.map((serviceTypeId) => buildAssignmentPayload(serviceId, serviceTypeId, serviceTypes, assignmentForm)), {
        onConflict: "service_id,service_type_id",
      });
    if (error) return "Não foi possível salvar as personalizações de algumas combinações.";
  }

  if (toRemove.length) {
    const { error } = await supabase.from("service_type_assignments").delete().eq("service_id", serviceId).in("service_type_id", toRemove);
    if (error) return "Não foi possível remover alguns vínculos da opção.";
  }

  return null;
};

export const fetchCategories = async () => {
  const { data, error } = await supabase
    .from("service_categories")
    .select("id, name, active, order_index")
    .order("order_index", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error } as const;
  return { data: normalizeCategories(data ?? []), error: null } as const;
};

export const fetchServiceTypes = async () => {
  const { data, error } = await supabase
    .from("service_types")
    .select(
      "id, name, active, category_id, order_index, base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min, category:service_categories(id, name)"
    )
    .order("order_index", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error } as const;
  return { data: normalizeServiceTypes(data ?? []), error: null } as const;
};

export const fetchOptionsList = async () => {
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, name, slug, description, duration_min, price_cents, deposit_cents, buffer_min, active, branch_id, assignments:service_type_assignments(service_type_id, use_service_defaults, override_duration_min, override_price_cents, override_deposit_cents, override_buffer_min, service_type:service_types(id, name, active, category_id, base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min, category:service_categories(id, name)))"
    )
    .order("name", { ascending: true });

  if (error) return { data: [], error } as const;
  return { data: normalizeOptions((data ?? []) as ServiceRow[]), error: null } as const;
};

export const fetchOptionWithAssignments = async (optionId: string) => {
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, name, slug, description, duration_min, price_cents, deposit_cents, buffer_min, active, branch_id, assignments:service_type_assignments(service_type_id, use_service_defaults, override_duration_min, override_price_cents, override_deposit_cents, override_buffer_min, service_type:service_types(id, name, active, category_id, base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min, category:service_categories(id, name)))"
    )
    .eq("id", optionId)
    .maybeSingle();

  if (error || !data) return { data: null, error: error ?? new Error("Opção não encontrada") } as const;

  const normalized = normalizeOptions([data as ServiceRow])[0];
  return { data: normalized, error: null } as const;
};

export const fetchOptionPhotos = async (optionId: string) => {
  const { data, error } = await supabase
    .from("service_photos")
    .select("id, url, order_index, created_at")
    .eq("service_id", optionId)
    .order("order_index", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) return { data: [], error } as const;
  return { data: (data ?? []) as ServicePhoto[], error: null } as const;
};
