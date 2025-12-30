"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { resolveFinalServiceValues, type ServiceAssignmentOverride } from "@/lib/servicePricing";

import { useAdminGuard } from "../../../useAdminGuard";
import styles from "./opcoes.module.css";

type ServiceTypeEntry = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  active: boolean;
  base_duration_min: number | null;
  base_price_cents: number | null;
  base_deposit_cents: number | null;
  base_buffer_min: number | null;
  branch_id: string | null;
  assignments?:
    | {
        use_service_defaults?: boolean | null;
        override_duration_min?: number | null;
        override_price_cents?: number | null;
        override_deposit_cents?: number | null;
        override_buffer_min?: number | null;
        services?:
          | {
              id?: string | null;
              name?: string | null;
              slug?: string | null;
              description?: string | null;
              active?: boolean | null;
              duration_min?: number | null;
              price_cents?: number | null;
              deposit_cents?: number | null;
              buffer_min?: number | null;
              assignments?:
                | {
                    service_type_id?: string | null;
                    service_type?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
                  }
                | {
                    service_type_id?: string | null;
                    service_type?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
                  }[]
                | null;
            }
          | {
              id?: string | null;
              name?: string | null;
              slug?: string | null;
              description?: string | null;
              active?: boolean | null;
              duration_min?: number | null;
              price_cents?: number | null;
              deposit_cents?: number | null;
              buffer_min?: number | null;
              assignments?:
                | {
                    service_type_id?: string | null;
                    service_type?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
                  }
                | {
                    service_type_id?: string | null;
                    service_type?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
                  }[]
                | null;
            }[]
          | null;
      }[]
    | null;
};

type CatalogOption = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  active: boolean;
  assignments: { service_type_id?: string | null }[];
};

type AssignmentDisplay = {
  serviceId: string;
  optionName: string;
  optionSlug: string | null;
  optionDescription: string | null;
  optionActive: boolean;
  useDefaults: boolean;
  overrides: ServiceAssignmentOverride;
  final: {
    duration: number;
    price: number;
    deposit: number;
    buffer: number;
  };
  assignmentCount: number;
  otherServiceNames: string[];
};

type ServiceDefaults = {
  duration: number;
  price: number;
  deposit: number;
  buffer: number;
};

const normalizeMinutes = (value: string | number | null | undefined) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(parsed ?? NaN)) return 0;
  return Math.max(0, Math.round(parsed ?? 0));
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

export default function ServiceOptionsPage() {
  const params = useParams<{ serviceTypeId: string }>();
  const router = useRouter();
  const serviceTypeId = params?.serviceTypeId;

  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [serviceType, setServiceType] = useState<ServiceTypeEntry | null>(null);
  const [serviceDefaults, setServiceDefaults] = useState<ServiceDefaults>({ duration: 0, price: 0, deposit: 0, buffer: 0 });
  const [assignments, setAssignments] = useState<AssignmentDisplay[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({ name: "", slug: "", description: "", active: true });
  const [linkingOptionId, setLinkingOptionId] = useState<string>("");
  const [overrideForm, setOverrideForm] = useState<
    Map<string, { useDefaults: boolean; duration: string; price: string; deposit: string; buffer: string }>
  >(new Map());

  const isSuper = role === "adminsuper" || role === "adminmaster";
  const isReadonly = role === "admin";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [serviceTypeResponse, catalogResponse] = await Promise.all([
      supabase
        .from("service_types")
        .select(
          "id, name, slug, description, active, base_duration_min, base_price_cents, base_deposit_cents, base_buffer_min, branch_id, assignments:service_type_assignments(use_service_defaults, override_duration_min, override_price_cents, override_deposit_cents, override_buffer_min, services:services(id, name, slug, description, active, duration_min, price_cents, deposit_cents, buffer_min, assignments:service_type_assignments(service_type_id, service_type:service_types(id, name))))"
        )
        .eq("id", serviceTypeId)
        .single(),
      supabase.from("services").select("id, name, slug, description, active, assignments:service_type_assignments(service_type_id)").order("name", { ascending: true }),
    ]);

    if (serviceTypeResponse.error || catalogResponse.error) {
      setError("Não foi possível carregar o serviço ou as opções.");
      setServiceType(null);
      setAssignments([]);
      setCatalogOptions([]);
      setLoading(false);
      return;
    }

    if (!serviceTypeResponse.data) {
      setError("Serviço não encontrado.");
      setServiceType(null);
      setAssignments([]);
      setCatalogOptions([]);
      setLoading(false);
      return;
    }

    const service = serviceTypeResponse.data as ServiceTypeEntry;
    const defaults = {
      duration: normalizeMinutes(service.base_duration_min ?? 0),
      price: Math.max(0, Math.round(service.base_price_cents ?? 0)),
      deposit: Math.max(0, Math.min(Math.round(service.base_price_cents ?? 0), Math.round(service.base_deposit_cents ?? 0))),
      buffer: normalizeMinutes(service.base_buffer_min ?? 0),
    };

    const normalizedAssignments: AssignmentDisplay[] = (service.assignments ?? [])
      .map((entry) => {
        const option = toArray(entry.services).find((item) => item && typeof item === "object");
        if (!option?.id) return null;

        const overrides: ServiceAssignmentOverride = {
          use_service_defaults: entry.use_service_defaults ?? true,
          override_duration_min: entry.override_duration_min ?? null,
          override_price_cents: entry.override_price_cents ?? null,
          override_deposit_cents: entry.override_deposit_cents ?? null,
          override_buffer_min: entry.override_buffer_min ?? null,
        };

        const final = resolveFinalServiceValues(
          {
            base_duration_min: service.base_duration_min ?? 0,
            base_price_cents: service.base_price_cents ?? 0,
            base_deposit_cents: service.base_deposit_cents ?? 0,
            base_buffer_min: service.base_buffer_min ?? 0,
          },
          overrides
        );

        const otherServiceNames = toArray(option.assignments)
          .map((assignment) => toArray(assignment?.service_type).find((item) => item && typeof item === "object")?.name ?? null)
          .filter((name): name is string => Boolean(name) && name !== service.name);

        return {
          serviceId: option.id ?? "",
          optionName: option.name ?? "Opção",
          optionSlug: option.slug ?? null,
          optionDescription: option.description ?? null,
          optionActive: option.active !== false,
          useDefaults: overrides.use_service_defaults !== false,
          overrides,
          final: {
            duration: final.duration_min,
            price: final.price_cents,
            deposit: final.deposit_cents,
            buffer: final.buffer_min,
          },
          assignmentCount: toArray(option.assignments).length,
          otherServiceNames,
        } as AssignmentDisplay;
      })
      .filter((item): item is AssignmentDisplay => Boolean(item))
      .sort((a, b) => a.optionName.localeCompare(b.optionName, "pt-BR"));

    const normalizedCatalog: CatalogOption[] =
      (catalogResponse.data ?? []).map((option) => ({
        id: option.id,
        name: option.name ?? "Opção",
        slug: option.slug ?? null,
        description: option.description ?? null,
        active: option.active !== false,
        assignments: toArray(option.assignments),
      })) ?? [];

    const overrideState = new Map<string, { useDefaults: boolean; duration: string; price: string; deposit: string; buffer: string }>();
    normalizedAssignments.forEach((assignment) => {
      overrideState.set(assignment.serviceId, {
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

    setServiceType(service);
    setServiceDefaults(defaults);
    setAssignments(normalizedAssignments);
    setCatalogOptions(normalizedCatalog);
    setOverrideForm(overrideState);
    setLoading(false);
  }, [serviceTypeId]);

  useEffect(() => {
    if (status !== "authorized" || !serviceTypeId) return;
    void loadData();
  }, [loadData, serviceTypeId, status]);

  const resetCreateForm = () => setCreateForm({ name: "", slug: "", description: "", active: true });

  const handleCreateOption = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSuper) {
      setError("Apenas Master ou Super podem criar opções.");
      return;
    }
    if (!serviceType) {
      setError("Serviço não encontrado.");
      return;
    }

    setSaving(true);
    setError(null);
    setNote(null);

    const payload = {
      name: createForm.name.trim() || "Opção",
      slug: normalizeSlug(createForm.slug, createForm.name),
      description: createForm.description.trim() || null,
      duration_min: serviceDefaults.duration,
      price_cents: serviceDefaults.price,
      deposit_cents: serviceDefaults.deposit,
      buffer_min: serviceDefaults.buffer,
      branch_id: serviceType.branch_id ?? null,
      active: Boolean(createForm.active),
    };

    const createResponse = await supabase.from("services").insert(payload).select("id").single();
    if (createResponse.error || !createResponse.data?.id) {
      setError("Não foi possível criar a opção. Verifique o slug e tente novamente.");
      setSaving(false);
      return;
    }

    const newId = createResponse.data.id as string;
    const linkResponse = await supabase.from("service_type_assignments").upsert(
      {
        service_id: newId,
        service_type_id: serviceType.id,
        use_service_defaults: true,
        override_duration_min: null,
        override_price_cents: null,
        override_deposit_cents: null,
        override_buffer_min: null,
      },
      { onConflict: "service_id,service_type_id" }
    );

    if (linkResponse.error) {
      setError("Opção criada, mas não foi possível vincular ao serviço.");
    } else {
      setNote("Opção criada e vinculada ao serviço.");
      resetCreateForm();
      setLinkingOptionId("");
      void loadData();
    }

    setSaving(false);
  };

  const handleLinkExisting = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSuper) {
      setError("Apenas Master ou Super podem vincular opções.");
      return;
    }
    if (!linkingOptionId) {
      setError("Selecione uma opção do catálogo para vincular.");
      return;
    }
    if (!serviceTypeId) {
      setError("Serviço não encontrado.");
      return;
    }

    setSaving(true);
    setError(null);
    setNote(null);

    const { error: linkError } = await supabase.from("service_type_assignments").upsert(
      {
        service_id: linkingOptionId,
        service_type_id: serviceTypeId,
        use_service_defaults: true,
        override_duration_min: null,
        override_price_cents: null,
        override_deposit_cents: null,
        override_buffer_min: null,
      },
      { onConflict: "service_id,service_type_id" }
    );

    if (linkError) {
      setError("Não foi possível vincular a opção selecionada.");
    } else {
      setNote("Opção vinculada ao serviço.");
      setLinkingOptionId("");
      void loadData();
    }

    setSaving(false);
  };

  const buildOverridePayload = (serviceId: string) => {
    const config = overrideForm.get(serviceId);
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

    const priceOverride = config?.price ? parseReaisToCents(config.price) : null;
    const depositOverrideRaw = config?.deposit ? parseReaisToCents(config.deposit) : null;
    const depositLimit = priceOverride ?? serviceDefaults.price;
    const depositOverride =
      depositOverrideRaw !== null && depositOverrideRaw !== undefined && Number.isFinite(depositOverrideRaw)
        ? Math.min(depositLimit, depositOverrideRaw)
        : null;

    return {
      service_id: serviceId,
      service_type_id: serviceTypeId,
      use_service_defaults: false,
      override_duration_min: config?.duration ? normalizeMinutes(config.duration) : null,
      override_price_cents: priceOverride,
      override_deposit_cents: depositOverride,
      override_buffer_min: config?.buffer ? normalizeMinutes(config.buffer) : null,
    };
  };

  const handleSaveOverrides = async (serviceId: string) => {
    if (!isSuper) {
      setError("Apenas Master ou Super podem personalizar opções.");
      return;
    }
    if (!serviceTypeId) {
      setError("Serviço não encontrado.");
      return;
    }

    setSaving(true);
    setError(null);
    setNote(null);

    const payload = buildOverridePayload(serviceId);
    const { error: upsertError } = await supabase
      .from("service_type_assignments")
      .upsert(payload, { onConflict: "service_id,service_type_id" });

    if (upsertError) {
      setError("Não foi possível salvar as personalizações desta opção.");
    } else {
      setNote("Personalização salva.");
      void loadData();
    }

    setSaving(false);
  };

  const handleUnlink = async (serviceId: string, assignmentCount: number) => {
    if (!isSuper) {
      setError("Apenas Master ou Super podem desvincular opções.");
      return;
    }
    if (!serviceTypeId) {
      setError("Serviço não encontrado.");
      return;
    }
    if (assignmentCount <= 1) {
      setError("Não é possível desvincular: a opção ficaria sem serviço.");
      return;
    }

    const confirmed = window.confirm("Deseja remover esta opção do serviço? Ela permanecerá vinculada aos demais serviços.");
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setNote(null);

    const { error: deleteError } = await supabase
      .from("service_type_assignments")
      .delete()
      .eq("service_id", serviceId)
      .eq("service_type_id", serviceTypeId);

    if (deleteError) {
      setError("Não foi possível remover o vínculo.");
    } else {
      setNote("Vínculo removido.");
      void loadData();
    }

    setSaving(false);
  };

  const availableOptions = useMemo(() => {
    const linkedIds = new Set(assignments.map((assignment) => assignment.serviceId));
    return catalogOptions.filter((option) => !linkedIds.has(option.id)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [assignments, catalogOptions]);

  if (status === "unauthorized") {
    router.replace("/login");
    return null;
  }

  return (
    <div className={styles.page}>
      <section className={styles.headerCard}>
        <div>
          <h1 className={styles.headerTitle}>Gerenciar opções</h1>
          <p className={styles.headerDescription}>
            Crie e vincule opções a partir do serviço. Valores padrão sempre vêm do Serviço; personalizações são salvas por combinação
            Serviço + Opção.
          </p>
        </div>
        <div className={styles.tagRow}>
          <span className={styles.tag}>Serviço como fonte de verdade</span>
          {!isSuper ? <span className={styles.tag}>Modo somente leitura</span> : null}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Serviço</p>
          <h2 className={styles.sectionTitle}>{serviceType?.name ?? "Serviço"}</h2>
          <p className={styles.sectionDescription}>
            {serviceType?.description || "Use os valores padrão do serviço como referência. Personalizações são aplicadas por opção."}
          </p>
        </div>
        {serviceType ? (
          <div className={styles.pillGroup}>
            <span className={styles.pill}>
              Padrão: {serviceDefaults.duration} min • {formatPriceLabel(serviceDefaults.price)} • Sinal{" "}
              {formatPriceLabel(serviceDefaults.deposit)} • Buffer {serviceDefaults.buffer} min
            </span>
            <span className={`${styles.badge} ${serviceType.active ? styles.statusActive : styles.statusInactive}`}>
              {serviceType.active ? "Serviço ativo" : "Serviço inativo"}
            </span>
            {serviceType.slug ? <span className={styles.pillMuted}>Slug: {serviceType.slug}</span> : null}
          </div>
        ) : (
          <div className={styles.helperText}>Carregando dados do serviço...</div>
        )}
        <div className={styles.buttonRow}>
          <Link href="/admin/servicos" className={styles.secondaryButton}>
            Voltar para Serviços
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Criar opção</p>
          <h2 className={styles.sectionTitle}>A opção já nasce vinculada ao serviço</h2>
          <p className={styles.sectionDescription}>
            Crie uma nova opção com nome, slug e descrição. Ela herda os valores padrão do serviço e já nasce vinculada.
          </p>
        </div>
        {error ? <div className={styles.helperText}>{error}</div> : null}
        {note ? <div className={styles.helperText}>{note}</div> : null}
        <form className={styles.formGrid} onSubmit={handleCreateOption}>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Nome</span>
            <input
              className={styles.inputControl}
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value, slug: prev.slug || slugify(event.target.value) }))}
              placeholder="Opção (ex: Foxy)"
              disabled={saving || isReadonly}
              required
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Slug</span>
            <input
              className={styles.inputControl}
              value={createForm.slug}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, slug: event.target.value }))}
              onBlur={(event) => setCreateForm((prev) => ({ ...prev, slug: normalizeSlug(event.target.value, prev.name) }))}
              placeholder="identificador-unico"
              disabled={saving || isReadonly}
              required
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Descrição</span>
            <textarea
              className={styles.textareaControl}
              value={createForm.description}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Detalhes da opção"
              disabled={saving || isReadonly}
            />
          </label>
          <label className={`${styles.inputGroup} ${styles.toggleRow}`}>
            <input
              type="checkbox"
              checked={createForm.active}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, active: event.target.checked }))}
              disabled={saving || isReadonly}
            />
            <span className={styles.inputLabel}>Opção ativa</span>
          </label>
          <div className={styles.helperText}>
            A duração, preço, sinal e buffer finais vêm do serviço, mas podem ser personalizados por opção logo abaixo.
          </div>
          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryButton} disabled={saving || isReadonly}>
              {saving ? "Salvando..." : "Criar e vincular"}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={resetCreateForm} disabled={saving}>
              Limpar
            </button>
          </div>
        </form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Vincular do catálogo</p>
          <h2 className={styles.sectionTitle}>Traga uma opção existente para este serviço</h2>
          <p className={styles.sectionDescription}>
            A opção selecionada será vinculada com os valores padrão do serviço. Personalizações podem ser feitas logo abaixo.
          </p>
        </div>
        <form className={styles.formGrid} onSubmit={handleLinkExisting}>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Opção do catálogo</span>
            <select
              className={styles.selectControl}
              value={linkingOptionId}
              onChange={(event) => setLinkingOptionId(event.target.value)}
              disabled={saving || isReadonly || loading}
            >
              <option value="">Selecione uma opção</option>
              {availableOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} {option.assignments.length === 0 ? "(sem serviço)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryButton} disabled={saving || isReadonly || !linkingOptionId}>
              {saving ? "Salvando..." : "Vincular opção"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Opções vinculadas</p>
          <h2 className={styles.sectionTitle}>Personalize cada combinação Serviço + Opção</h2>
          <p className={styles.sectionDescription}>
            Os valores padrão vêm do serviço. Desligue o toggle para personalizar somente esta combinação. Nunca há soma de valores: é
            sempre override final.
          </p>
        </div>
        {loading ? (
          <div className={styles.helperText}>Carregando opções...</div>
        ) : assignments.length ? (
          <div className={styles.optionGrid}>
            {assignments.map((assignment) => {
              const config = overrideForm.get(assignment.serviceId) ?? {
                useDefaults: assignment.useDefaults,
                duration: "",
                price: "",
                deposit: "",
                buffer: "",
              };
              const defaultValues = resolveFinalServiceValues(
                {
                  base_duration_min: serviceDefaults.duration,
                  base_price_cents: serviceDefaults.price,
                  base_deposit_cents: serviceDefaults.deposit,
                  base_buffer_min: serviceDefaults.buffer,
                },
                { use_service_defaults: true }
              );
              const overrideValues = resolveFinalServiceValues(
                {
                  base_duration_min: serviceDefaults.duration,
                  base_price_cents: serviceDefaults.price,
                  base_deposit_cents: serviceDefaults.deposit,
                  base_buffer_min: serviceDefaults.buffer,
                },
                {
                  use_service_defaults: config.useDefaults,
                  override_duration_min: config.duration ? normalizeMinutes(config.duration) : null,
                  override_price_cents: config.price ? parseReaisToCents(config.price) : null,
                  override_deposit_cents: config.deposit ? parseReaisToCents(config.deposit) : null,
                  override_buffer_min: config.buffer ? normalizeMinutes(config.buffer) : null,
                }
              );

              return (
                <div key={assignment.serviceId} className={styles.optionCard}>
                  <div className={styles.optionHeader}>
                    <div>
                      <h3 className={styles.optionTitle}>{assignment.optionName}</h3>
                      <p className={styles.sectionDescription}>{assignment.optionDescription || "Sem descrição"}</p>
                    </div>
                    <span className={`${styles.badge} ${assignment.optionActive ? styles.statusActive : styles.statusInactive}`}>
                      {assignment.optionActive ? "Opção ativa" : "Opção inativa"}
                    </span>
                  </div>
                  <div className={styles.pillGroup}>
                    <span className={styles.pill}>Slug: {assignment.optionSlug || "sem-slug"}</span>
                    <span className={styles.pillMuted}>
                      {assignment.assignmentCount === 1
                        ? "Apenas neste serviço"
                        : `${assignment.assignmentCount} serviços (${assignment.otherServiceNames.join(", ") || "inclui este"})`}
                    </span>
                  </div>
                  <label className={`${styles.inputGroup} ${styles.toggleRow}`}>
                    <input
                      type="checkbox"
                      checked={config.useDefaults}
                      onChange={(event) =>
                        setOverrideForm((prev) => {
                          const next = new Map(prev);
                          const current = prev.get(assignment.serviceId) ?? { useDefaults: true, duration: "", price: "", deposit: "", buffer: "" };
                          next.set(assignment.serviceId, { ...current, useDefaults: event.target.checked });
                          return next;
                        })
                      }
                      disabled={saving || isReadonly}
                    />
                    <span className={styles.inputLabel}>Usar padrão do serviço</span>
                  </label>

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
                            setOverrideForm((prev) => {
                              const next = new Map(prev);
                              const current = prev.get(assignment.serviceId) ?? { useDefaults: false, duration: "", price: "", deposit: "", buffer: "" };
                              next.set(assignment.serviceId, { ...current, duration: event.target.value });
                              return next;
                            })
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
                            setOverrideForm((prev) => {
                              const next = new Map(prev);
                              const current = prev.get(assignment.serviceId) ?? { useDefaults: false, duration: "", price: "", deposit: "", buffer: "" };
                              next.set(assignment.serviceId, { ...current, price: event.target.value });
                              return next;
                            })
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
                            setOverrideForm((prev) => {
                              const next = new Map(prev);
                              const current = prev.get(assignment.serviceId) ?? { useDefaults: false, duration: "", price: "", deposit: "", buffer: "" };
                              next.set(assignment.serviceId, { ...current, deposit: event.target.value });
                              return next;
                            })
                          }
                          disabled={saving || isReadonly}
                        />
                        <p className={styles.helperText}>Limitado ao valor final informado.</p>
                      </label>
                      <label className={styles.inputGroup}>
                        <span className={styles.inputLabel}>Buffer final (min)</span>
                        <input
                          className={styles.inputControl}
                          type="number"
                          min={0}
                          value={config.buffer}
                          onChange={(event) =>
                            setOverrideForm((prev) => {
                              const next = new Map(prev);
                              const current = prev.get(assignment.serviceId) ?? { useDefaults: false, duration: "", price: "", deposit: "", buffer: "" };
                              next.set(assignment.serviceId, { ...current, buffer: event.target.value });
                              return next;
                            })
                          }
                          disabled={saving || isReadonly}
                        />
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
                      Final: {overrideValues.duration_min} min • {formatPriceLabel(overrideValues.price_cents)} • Sinal{" "}
                      {formatPriceLabel(overrideValues.deposit_cents)} • Buffer {overrideValues.buffer_min} min
                    </span>
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => handleSaveOverrides(assignment.serviceId)}
                      disabled={saving || isReadonly}
                    >
                      Salvar personalização
                    </button>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.dangerButton}`}
                      onClick={() => handleUnlink(assignment.serviceId, assignment.assignmentCount)}
                      disabled={saving || isReadonly}
                    >
                      Desvincular
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>Nenhuma opção vinculada a este serviço.</div>
        )}
      </section>
    </div>
  );
}
