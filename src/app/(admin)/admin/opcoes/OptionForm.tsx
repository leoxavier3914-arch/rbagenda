/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";

import {
  type AssignmentConfig,
  type CategoryOption,
  type NormalizedOption,
  type ServicePhoto,
  type ServiceTypeOption,
  defaultAssignmentConfig,
  defaultOptionForm,
  fetchOptionPhotos,
  formatPriceLabel,
  mapAssignmentFormFromDisplays,
  normalizeInt,
  normalizeSlug,
  parseReaisToCents,
  resolveCategoryMeta,
  resolveFinalServiceValues,
  servicePhotosBucket,
  syncAssignments,
} from "./shared";
import { supabase } from "@/lib/db";

type OptionFormProps = {
  mode: "create" | "edit";
  optionId?: string;
  categories: CategoryOption[];
  serviceTypes: ServiceTypeOption[];
  initialOption?: NormalizedOption | null;
  initialPhotos?: ServicePhoto[];
  styles: Record<string, string>;
  readOnly?: boolean;
};

export function OptionForm({ mode, optionId, categories, serviceTypes, initialOption, initialPhotos, styles, readOnly }: OptionFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(defaultOptionForm);
  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<Set<string>>(new Set());
  const [assignmentForm, setAssignmentForm] = useState<Map<string, AssignmentConfig>>(new Map());
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceSelectionCategory, setServiceSelectionCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ServicePhoto[]>(initialPhotos ?? []);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [photosNote, setPhotosNote] = useState<string | null>(null);

  useEffect(() => {
    if (!initialOption) {
      setForm(defaultOptionForm);
      setSelectedServiceTypeIds(new Set());
      setAssignmentForm(new Map());
      return;
    }

    setForm({
      name: initialOption.name ?? "",
      slug: initialOption.slug ?? "",
      description: initialOption.description ?? "",
      active: initialOption.active !== false,
    });
    setSelectedServiceTypeIds(new Set(initialOption.serviceTypeIds));
    setAssignmentForm(mapAssignmentFormFromDisplays(initialOption.assignments));
  }, [initialOption]);

  useEffect(() => {
    if (!optionId) return;
    void loadPhotos(optionId);
  }, [optionId]);

  const loadPhotos = async (serviceId: string) => {
    setPhotosLoading(true);
    setPhotosError(null);
    setPhotosNote(null);
    const { data, error: fetchError } = await fetchOptionPhotos(serviceId);
    if (fetchError) {
      setPhotosError("Não foi possível carregar as fotos da opção.");
    } else {
      setPhotos(data);
    }
    setPhotosLoading(false);
  };

  const getAssignmentConfig = (serviceTypeId: string) => assignmentForm.get(serviceTypeId) ?? defaultAssignmentConfig;

  const updateAssignmentConfig = (serviceTypeId: string, updater: (config: AssignmentConfig) => AssignmentConfig) => {
    setAssignmentForm((prev) => {
      const next = new Map(prev);
      const current = prev.get(serviceTypeId) ?? defaultAssignmentConfig;
      next.set(serviceTypeId, updater(current));
      return next;
    });
  };

  const filteredServiceTypes = useMemo(() => {
    const normalizedSearch = serviceSearch.trim().toLowerCase();
    return serviceTypes
      .filter((serviceType) => {
        const matchesSearch = normalizedSearch.length ? serviceType.name.toLowerCase().includes(normalizedSearch) : true;
        const categoryMeta = resolveCategoryMeta(serviceType);
        const matchesCategory = serviceSelectionCategory ? categoryMeta.id === serviceSelectionCategory : true;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [serviceSearch, serviceSelectionCategory, serviceTypes]);

  const selectedServiceTypes = useMemo(
    () => serviceTypes.filter((serviceType) => selectedServiceTypeIds.has(serviceType.id)),
    [selectedServiceTypeIds, serviceTypes]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) {
      setError("Apenas Master ou Super podem editar opções.");
      return;
    }
    if (selectedServiceTypeIds.size === 0) {
      setError("Selecione pelo menos um serviço para esta opção.");
      setSelectionError("Selecione pelo menos um serviço para esta opção.");
      return;
    }

    setSaving(true);
    setError(null);
    setNote(null);

    const desiredAssignments = Array.from(selectedServiceTypeIds);
    const primaryServiceType = desiredAssignments.length
      ? serviceTypes.find((serviceType) => serviceType.id === desiredAssignments[0])
      : null;

    const existingFinal = initialOption?.assignments[0]?.final;
    const legacyDuration = Math.max(1, normalizeInt(existingFinal?.duration ?? primaryServiceType?.base_duration_min ?? 30, 30));
    const legacyPrice = Math.max(0, normalizeInt(existingFinal?.price ?? primaryServiceType?.base_price_cents ?? 0, 0));
    const legacyDepositRaw = Math.max(0, normalizeInt(existingFinal?.deposit ?? primaryServiceType?.base_deposit_cents ?? 0, 0));
    const legacyDeposit = Math.min(legacyPrice, legacyDepositRaw);
    const legacyBuffer = Math.max(0, normalizeInt(existingFinal?.buffer ?? primaryServiceType?.base_buffer_min ?? 0, 0));

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

    const response =
      mode === "edit" && optionId
        ? await supabase.from("services").update(payload).eq("id", optionId).select("id")
        : await supabase.from("services").insert(payload).select("id");

    if (response.error || !response.data?.length) {
      setError("Não foi possível salvar a opção. Verifique os campos e tente novamente.");
      setSaving(false);
      return;
    }

    const targetId = response.data[0].id as string;
    const existingAssignments = initialOption?.serviceTypeIds ?? [];
    const assignmentError = await syncAssignments(targetId, existingAssignments, desiredAssignments, serviceTypes, assignmentForm);
    if (assignmentError) {
      setError(assignmentError);
      setSaving(false);
      return;
    }

    setNote(mode === "edit" ? "Opção atualizada." : "Opção criada.");
    router.push("/admin/opcoes");
    setSaving(false);
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!optionId) {
      setPhotosError("Salve a opção antes de enviar fotos.");
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotosLoading(true);
    setPhotosError(null);
    setPhotosNote(null);

    const bucket = servicePhotosBucket;
    const path = `${optionId}/${Date.now()}-${file.name}`;

    const uploadResponse = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadResponse.error) {
      setPhotosError("Falha ao enviar a foto. Verifique o tamanho e tente novamente.");
      setPhotosLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("service_photos").insert({
      service_id: optionId,
      url: path,
      order_index: photos.length,
    });

    if (insertError) {
      setPhotosError("Foto enviada, mas não foi possível registrar no catálogo.");
    } else {
      setPhotosNote("Foto adicionada.");
      void loadPhotos(optionId);
    }

    setPhotosLoading(false);
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!optionId) return;
    setPhotosLoading(true);
    setPhotosError(null);
    setPhotosNote(null);

    const { error: deleteError } = await supabase.from("service_photos").delete().eq("id", photoId);
    if (deleteError) {
      setPhotosError("Não foi possível remover a foto.");
    } else {
      setPhotosNote("Foto removida.");
      void loadPhotos(optionId);
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
    } else if (optionId) {
      setPhotosNote("Ordem atualizada.");
      void loadPhotos(optionId);
    }
    setPhotosLoading(false);
  };

  return (
    <form className={styles.formCard} onSubmit={handleSubmit}>
      <div className={styles.sectionHeader}>
        <p className={styles.eyebrow}>{mode === "edit" ? "Editar opção" : "Nova opção"}</p>
        <h2 className={styles.cardTitle}>{mode === "edit" ? "Atualize os dados da opção" : "Crie uma nova opção"}</h2>
        <p className={styles.cardDescription}>
          Dados, vínculos e personalização em um único fluxo. Salve apenas quando houver pelo menos um serviço selecionado.
        </p>
      </div>

      {error ? <div className={styles.helperTextError}>{error}</div> : null}
      {note ? <div className={styles.helperText}>{note}</div> : null}

      <div className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <div>
            <p className={styles.eyebrow}>A) Dados da opção</p>
            <h3 className={styles.sectionTitle}>Identidade e fotos</h3>
            <p className={styles.cardDescription}>Nome, slug, descrição, status e galeria vivem aqui.</p>
          </div>
        </div>

        <div className={styles.fieldGrid}>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Nome</span>
            <input
              className={styles.inputControl}
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                  slug: prev.slug || normalizeSlug(event.target.value, event.target.value),
                }))
              }
              placeholder="Opção (ex: Foxy)"
              required
              disabled={readOnly || saving}
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
              required
              disabled={readOnly || saving}
            />
          </label>
          <label className={styles.inputGroup} data-span="2">
            <span className={styles.inputLabel}>Descrição</span>
            <textarea
              className={styles.textareaControl}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Detalhes da opção"
              disabled={readOnly || saving}
            />
          </label>
          <label className={`${styles.inputGroup} ${styles.toggleRow}`}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
              disabled={readOnly || saving}
            />
            <span className={styles.inputLabel}>Opção ativa</span>
          </label>
        </div>

        <div className={styles.photoPanel}>
          <div className={styles.photoHeader}>
            <div>
              <p className={styles.eyebrow}>Galeria</p>
              <p className={styles.cardDescription}>Fotos desta opção ficam aqui.</p>
            </div>
            {optionId ? (
              <label className={styles.secondaryButton}>
                <input type="file" accept="image/*" hidden onChange={handlePhotoUpload} disabled={photosLoading || readOnly} />
                {photosLoading ? "Enviando..." : "Enviar foto"}
              </label>
            ) : (
              <span className={styles.helperText}>Disponível após criar a opção.</span>
            )}
          </div>
          {photosError ? <div className={styles.helperTextError}>{photosError}</div> : null}
          {photosNote ? <div className={styles.helperText}>{photosNote}</div> : null}

          {photosLoading ? (
            <p className={styles.helperText}>Carregando fotos...</p>
          ) : photos.length ? (
            <div className={styles.photoGrid}>
              {photos.map((photo) => (
                <div key={photo.id} className={styles.photoCard}>
                  {photo.signedUrl ? (
                    <img src={photo.signedUrl} alt="" className={styles.photoPreview} />
                  ) : (
                    <div className={styles.photoPlaceholder}>Sem imagem</div>
                  )}
                  <div className={styles.photoMeta}>
                    <label className={styles.inputGroup}>
                      <span className={styles.inputLabel}>Ordem</span>
                      <input
                        className={styles.inputControl}
                        type="number"
                        min={0}
                        value={photo.order_index ?? 0}
                        onChange={(event) => handlePhotoOrderChange(photo.id, normalizeInt(event.target.value, 0))}
                        disabled={readOnly || photosLoading}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => handlePhotoDelete(photo.id)}
                      disabled={readOnly || photosLoading}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.helperText}>{optionId ? "Nenhuma foto cadastrada." : "Salve para enviar fotos."}</p>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <div>
            <p className={styles.eyebrow}>B) Serviços onde esta opção será vinculada (obrigatório)</p>
            <h3 className={styles.sectionTitle}>Escolha serviços e garanta ao menos 1</h3>
            <p className={styles.cardDescription}>Checklist com busca e filtro de categoria.</p>
          </div>
          <div className={styles.inlineInfo}>
            <span className={styles.inputLabel}>Selecionados</span>
            <span className={styles.pill}>{selectedServiceTypeIds.size}</span>
          </div>
        </div>

        {selectionError ? <div className={styles.helperTextError}>{selectionError}</div> : null}

        <div className={styles.serviceToolbar}>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Buscar serviço</span>
            <input
              className={styles.inputControl}
              value={serviceSearch}
              onChange={(event) => setServiceSearch(event.target.value)}
              placeholder="Digite o nome do serviço"
              disabled={readOnly || saving}
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Filtrar por categoria</span>
            <select
              className={styles.selectControl}
              value={serviceSelectionCategory}
              onChange={(event) => setServiceSelectionCategory(event.target.value)}
              disabled={readOnly || saving}
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

        <div className={styles.serviceGrid}>
          {filteredServiceTypes.length ? (
            filteredServiceTypes.map((service) => (
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
                      setSelectionError(next.size ? null : "Selecione pelo menos um serviço para esta opção.");
                      return next;
                    });
                  }}
                  disabled={readOnly || saving}
                />
                <div className={styles.serviceRowBody}>
                  <div className={styles.serviceRowHeader}>
                    <span className={styles.serviceName}>{service.name}</span>
                    <span className={`${styles.badge} ${service.active !== false ? styles.badgeActive : styles.badgeInactive}`}>
                      {service.active !== false ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className={styles.serviceMeta}>
                    {resolveCategoryMeta(service).name ?? "Sem categoria"} • {service.base_duration_min ?? 0} min •{" "}
                    {formatPriceLabel(service.base_price_cents ?? 0)}
                  </p>
                </div>
              </label>
            ))
          ) : (
            <p className={styles.helperText}>Nenhum serviço encontrado com os filtros informados.</p>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <div>
            <p className={styles.eyebrow}>C) Configuração por serviço</p>
            <h3 className={styles.sectionTitle}>Personalize onde for necessário</h3>
            <p className={styles.cardDescription}>
              Para cada serviço marcado, escolha usar o padrão ou aplique valores finais (override) de tempo, preço, sinal e buffer.
            </p>
          </div>
        </div>

        {selectedServiceTypes.length === 0 ? (
          <p className={styles.helperText}>Selecione ao menos um serviço para personalizar.</p>
        ) : (
          <div className={styles.optionGrid}>
            {selectedServiceTypes.map((serviceType) => {
              const config = getAssignmentConfig(serviceType.id);
              const overridePayload = {
                use_service_defaults: config.useDefaults,
                override_duration_min:
                  !config.useDefaults && config.duration.length > 0 ? normalizeInt(config.duration, serviceType.base_duration_min ?? 0) : null,
                override_price_cents: !config.useDefaults && config.price.length > 0 ? parseReaisToCents(config.price) : null,
                override_deposit_cents: !config.useDefaults && config.deposit.length > 0 ? parseReaisToCents(config.deposit) : null,
                override_buffer_min:
                  !config.useDefaults && config.buffer.length > 0 ? normalizeInt(config.buffer, serviceType.base_buffer_min ?? 0) : null,
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
                      <h4 className={styles.optionTitle}>{serviceType.name}</h4>
                      <p className={styles.serviceMeta}>{serviceType.category_name || "Sem categoria"}</p>
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
                        disabled={readOnly || saving}
                      />
                      <span className={styles.inputLabel}>Usar padrão do serviço</span>
                    </label>
                  </div>

                  {!config.useDefaults ? (
                    <div className={styles.fieldGrid}>
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
                          disabled={readOnly || saving}
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
                          disabled={readOnly || saving}
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
                          disabled={readOnly || saving}
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
                          disabled={readOnly || saving}
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
      </div>

      <div className={styles.actionsRow}>
        <button type="submit" className={styles.primaryButton} disabled={saving || readOnly}>
          {saving ? "Salvando..." : mode === "edit" ? "Salvar alterações" : "Criar opção"}
        </button>
        <Link className={styles.secondaryButton} href="/admin/opcoes">
          Cancelar / Voltar
        </Link>
      </div>
      <p className={styles.helperText}>Salvar aplica vínculos obrigatórios e overrides de uma só vez.</p>
    </form>
  );
}
