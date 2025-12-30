import { supabase } from "@/lib/db";
import { slugify } from "@/lib/slug";

export type CategoryOption = {
  id: string;
  name: string;
  order_index: number;
  active: boolean;
};

type ServiceTypeRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  active?: boolean | null;
  order_index?: number | null;
  category_id?: string | null;
  base_duration_min?: number | null;
  base_price_cents?: number | null;
  base_deposit_cents?: number | null;
  base_buffer_min?: number | null;
  category?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
  branch?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
  assignments?: { services?: { id?: string | null; name?: string | null; active?: boolean | null } | { id?: string | null; name?: string | null; active?: boolean | null }[] | null }[] | null;
};

export type NormalizedService = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  active: boolean;
  order_index: number;
  category_id: string | null;
  category_name: string | null;
  branch_name: string | null;
  defaults: {
    duration: number;
    price: number;
    deposit: number;
    buffer: number;
  };
  options: string[];
};

export type ServiceFormState = {
  name: string;
  slug: string;
  description: string;
  order_index: number;
  active: boolean;
  category_id: string;
  base_duration_min: number;
  base_price_reais: string;
  base_deposit_reais: string;
  base_buffer_min: number;
};

export const defaultServiceForm: ServiceFormState = {
  name: "",
  slug: "",
  description: "",
  order_index: 0,
  active: true,
  category_id: "",
  base_duration_min: 0,
  base_price_reais: "0",
  base_deposit_reais: "0",
  base_buffer_min: 0,
};

export const normalizeOrder = (value: string | number) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

export const normalizeSlug = (value: string, fallback: string) => {
  const base = value?.trim().length ? value : fallback;
  return slugify(base || "servico");
};

export const normalizeMinutes = (value: string | number) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(parsed)) return 0;
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

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const dedupeOptions = (assignments: ServiceTypeRow["assignments"]) => {
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

const normalizeServiceRows = (entries: ServiceTypeRow[]): NormalizedService[] =>
  (entries ?? []).map((entry) => {
    const category = toArray(entry.category).find((cat) => cat && typeof cat === "object");
    const branch = toArray(entry.branch).find((br) => br && typeof br === "object");

    const basePrice = Math.max(0, Math.round(entry.base_price_cents ?? 0));
    const baseDeposit = Math.max(0, Math.min(basePrice, Math.round(entry.base_deposit_cents ?? 0)));

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
      defaults: {
        duration: normalizeMinutes(entry.base_duration_min ?? 0),
        price: basePrice,
        deposit: baseDeposit,
        buffer: normalizeMinutes(entry.base_buffer_min ?? 0),
      },
      options: dedupeOptions(entry.assignments),
    } satisfies NormalizedService;
  });

export const fetchCategories = async () => {
  const { data, error } = await supabase
    .from("service_categories")
    .select("id, name, order_index, active")
    .order("order_index", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error } as const;

  return {
    data:
      (data ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name ?? "Categoria",
        order_index: normalizeOrder(entry.order_index ?? 0),
        active: entry.active !== false,
      })) ?? [],
    error: null,
  } as const;
};

export const fetchServicesList = async () => {
  const { data, error } = await supabase
    .from("service_types")
    .select(
      "id, name, slug, description, active, order_index, category_id, base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min, category:service_categories(id, name), branch:branches(id, name), assignments:service_type_assignments(services:services(id, name, active))"
    )
    .order("order_index", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error } as const;
  return { data: normalizeServiceRows((data ?? []) as ServiceTypeRow[]), error: null } as const;
};

export const fetchServiceById = async (serviceId: string) => {
  const { data, error } = await supabase
    .from("service_types")
    .select(
      "id, name, slug, description, active, order_index, category_id, base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min, category:service_categories(id, name), branch:branches(id, name), assignments:service_type_assignments(services:services(id, name, active))"
    )
    .eq("id", serviceId)
    .maybeSingle();

  if (error || !data) return { data: null, error: error ?? new Error("Serviço não encontrado") } as const;
  return { data: normalizeServiceRows([data as ServiceTypeRow])[0], error: null } as const;
};

export const mapFormFromService = (service: NormalizedService): ServiceFormState => ({
  name: service.name ?? "",
  slug: service.slug ?? "",
  description: service.description ?? "",
  order_index: normalizeOrder(service.order_index),
  active: service.active !== false,
  category_id: service.category_id ?? "",
  base_duration_min: service.defaults.duration,
  base_price_reais: formatMoneyInput(service.defaults.price),
  base_deposit_reais: formatMoneyInput(service.defaults.deposit),
  base_buffer_min: service.defaults.buffer,
});
