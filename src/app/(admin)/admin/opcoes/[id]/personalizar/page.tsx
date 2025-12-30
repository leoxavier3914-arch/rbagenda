"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  type AssignmentConfig,
  type NormalizedOption,
  type ServiceTypeOption,
  formatPriceLabel,
  mapAssignmentFormFromDisplays,
  normalizeInt,
  parseReaisToCents,
  resolveFinalServiceValues,
  syncAssignments,
} from "../../shared";
import { useAdminGuard } from "../../../../useAdminGuard";
import { fetchOptionWithAssignments, fetchServiceTypes } from "../../shared";
import styles from "./personalizar.module.css";

type Params = {
  params: { id: string };
};

export default function PersonalizarOpcaoPage({ params }: Params) {
  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const router = useRouter();
  const [option, setOption] = useState<NormalizedOption | null>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);
  const [assignmentForm, setAssignmentForm] = useState<Map<string, AssignmentConfig>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const optionIdOrSlug = params.id;
  const isReadonly = role === "admin";

  useEffect(() => {
    if (status !== "authorized" || !optionIdOrSlug) return;
    void loadData(optionIdOrSlug);
  }, [status, optionIdOrSlug]);

  const loadData = async (idOrSlug: string) => {
    setLoading(true);
    setError(null);

    const optionResponse = await fetchOptionWithAssignments(idOrSlug);

    if (optionResponse.error) {
      setError("Não foi possível carregar esta opção. Verifique permissões ou conexão.");
      setOption(null);
      setServiceTypes([]);
      setAssignmentForm(new Map());
      setLoading(false);
      return;
    }

    if (optionResponse.notFound || !optionResponse.data) {
      setError("Opção não encontrada.");
      setOption(null);
      setServiceTypes([]);
      setAssignmentForm(new Map());
      setLoading(false);
      return;
    }

    const serviceTypesResponse = await fetchServiceTypes();
    if (serviceTypesResponse.error) {
      setError("Não foi possível carregar serviços vinculados. Tente novamente.");
    }

    setOption(optionResponse.data);
    setServiceTypes(serviceTypesResponse.data);
    setAssignmentForm(mapAssignmentFormFromDisplays(optionResponse.data.assignments));
    setLoading(false);
  };

  const updateAssignmentConfig = (serviceTypeId: string, updater: (config: AssignmentConfig) => AssignmentConfig) => {
    setAssignmentForm((prev) => {
      const next = new Map(prev);
      const current = prev.get(serviceTypeId) ?? { useDefaults: true, duration: "", price: "", deposit: "", buffer: "" };
      next.set(serviceTypeId, updater(current));
      return next;
    });
  };

  const linkedServiceTypes = useMemo(
    () => serviceTypes.filter((serviceType) => option?.serviceTypeIds.includes(serviceType.id)),
    [option?.serviceTypeIds, serviceTypes]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!option) return;
    if (isReadonly) {
      setError("Apenas Master ou Super podem editar opções.");
      return;
    }
    setSaving(true);
    setError(null);
    setNote(null);

    const existingAssignments = option.serviceTypeIds;
    const assignmentError = await syncAssignments(option.id, existingAssignments, existingAssignments, serviceTypes, assignmentForm);
    if (assignmentError) {
      setError(assignmentError);
      setSaving(false);
      return;
    }

    setNote("Personalizações salvas.");
    router.push("/admin/opcoes");
    setSaving(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Opções · Personalizar</p>
          <h1 className={styles.title}>Configuração final por serviço</h1>
          <p className={styles.subtitle}>Somente serviços já vinculados podem ser personalizados aqui.</p>
          {isReadonly ? <span className={styles.tag}>Somente leitura para admins</span> : null}
        </div>
        <Link className={styles.secondaryButton} href="/admin/opcoes">
          Voltar para lista
        </Link>
      </header>

      {error ? <div className={styles.helperTextError}>{error}</div> : null}
      {note ? <div className={styles.helperText}>{note}</div> : null}

      {loading ? (
        <div className={styles.helperText}>Carregando serviços vinculados...</div>
      ) : option ? (
        <form className={styles.section} onSubmit={handleSubmit}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Configuração por serviço</p>
              <h2 className={styles.sectionTitle}>{option.name}</h2>
              <p className={styles.subtitle}>Atualize overrides finais sem alterar dados da opção.</p>
            </div>
          </div>

          {linkedServiceTypes.length === 0 ? (
            <p className={styles.helperText}>Nenhum serviço vinculado a esta opção.</p>
          ) : (
            <div className={styles.optionGrid}>
              {linkedServiceTypes.map((serviceType) => {
                const config = assignmentForm.get(serviceType.id) ?? {
                  useDefaults: true,
                  duration: "",
                  price: "",
                  deposit: "",
                  buffer: "",
                };
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
                        <h3 className={styles.optionTitle}>{serviceType.name}</h3>
                        <p className={styles.muted}>{serviceType.category_name || "Sem categoria"}</p>
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
                          disabled={isReadonly || saving}
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
                            disabled={isReadonly || saving}
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
                            disabled={isReadonly || saving}
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
                            disabled={isReadonly || saving}
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
                            disabled={isReadonly || saving}
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

          <div className={styles.actionsRow}>
            <button type="submit" className={styles.primaryButton} disabled={saving || isReadonly}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <Link className={styles.secondaryButton} href="/admin/opcoes">
              Cancelar / Voltar
            </Link>
          </div>
        </form>
      ) : (
        <div className={styles.helperTextError}>Opção não encontrada.</div>
      )}
    </div>
  );
}
