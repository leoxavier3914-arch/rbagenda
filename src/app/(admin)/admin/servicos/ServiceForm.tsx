"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { supabase } from "@/lib/db";

import {
  type CategoryOption,
  type NormalizedService,
  defaultServiceForm,
  normalizeMinutes,
  normalizeOrder,
  normalizeSlug,
  parseReaisToCents,
  ServiceFormState,
} from "./shared";

type ServiceFormProps = {
  mode: "create" | "edit";
  serviceId?: string;
  categories: CategoryOption[];
  initialService?: NormalizedService | null;
  readOnly?: boolean;
  styles: Record<string, string>;
};

export function ServiceForm({ mode, serviceId, categories, initialService, readOnly, styles }: ServiceFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ServiceFormState>(defaultServiceForm);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initialService) {
      setForm(defaultServiceForm);
      return;
    }
    setForm({
      name: initialService.name ?? "",
      slug: initialService.slug ?? "",
      description: initialService.description ?? "",
      order_index: normalizeOrder(initialService.order_index),
      active: initialService.active !== false,
      category_id: initialService.category_id ?? "",
      base_duration_min: initialService.defaults.duration,
      base_price_reais: (initialService.defaults.price / 100).toFixed(2),
      base_deposit_reais: (initialService.defaults.deposit / 100).toFixed(2),
      base_buffer_min: initialService.defaults.buffer,
    });
  }, [initialService]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) {
      setError("Apenas Master ou Super podem editar serviços.");
      return;
    }

    setSaving(true);
    setError(null);
    setNote(null);

    const basePrice = parseReaisToCents(form.base_price_reais);
    const baseDeposit = Math.min(basePrice, parseReaisToCents(form.base_deposit_reais));

    const payload = {
      name: form.name.trim() || "Serviço",
      slug: normalizeSlug(form.slug, form.name),
      description: form.description.trim() || null,
      active: Boolean(form.active),
      order_index: normalizeOrder(form.order_index),
      category_id: form.category_id ? form.category_id : null,
      base_duration_min: normalizeMinutes(form.base_duration_min),
      base_price_cents: basePrice,
      base_deposit_cents: baseDeposit,
      base_buffer_min: normalizeMinutes(form.base_buffer_min),
    };

    const response =
      mode === "edit" && serviceId
        ? await supabase.from("service_types").update(payload).eq("id", serviceId)
        : await supabase.from("service_types").insert(payload);

    if (response.error) {
      setError("Não foi possível salvar o serviço. Verifique o slug e as permissões.");
      setSaving(false);
      return;
    }

    setNote(mode === "edit" ? "Serviço atualizado." : "Serviço criado.");
    router.push("/admin/servicos");
    setSaving(false);
  };

  return (
    <form className={styles.formCard} onSubmit={handleSubmit}>
      <div className={styles.sectionHeader}>
        <p className={styles.eyebrow}>{mode === "edit" ? "Editar serviço" : "Novo serviço"}</p>
        <h2 className={styles.cardTitle}>{mode === "edit" ? "Atualize um serviço existente" : "Cadastre um serviço"}</h2>
        <p className={styles.cardDescription}>Defina os padrões deste serviço. As opções vinculadas continuam no fluxo atual.</p>
      </div>

      {error ? <div className={styles.helperTextError}>{error}</div> : null}
      {note ? <div className={styles.helperText}>{note}</div> : null}

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
            placeholder="Serviço (ex: Depilação)"
            disabled={saving || readOnly}
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
            disabled={saving || readOnly}
            required
          />
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Categoria</span>
          <select
            className={styles.selectControl}
            value={form.category_id}
            onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))}
            disabled={saving || readOnly}
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
          <span className={styles.inputLabel}>Duração padrão (min)</span>
          <input
            className={styles.inputControl}
            type="number"
            min={0}
            value={form.base_duration_min}
            onChange={(event) => setForm((prev) => ({ ...prev, base_duration_min: normalizeMinutes(event.target.value) }))}
            disabled={saving || readOnly}
          />
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Preço padrão (R$)</span>
          <input
            className={styles.inputControl}
            type="number"
            min={0}
            step="0.01"
            value={form.base_price_reais}
            onChange={(event) => setForm((prev) => ({ ...prev, base_price_reais: event.target.value }))}
            disabled={saving || readOnly}
          />
          <p className={styles.helperText}>Valor base do serviço. Centavos são calculados automaticamente.</p>
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Sinal padrão (R$)</span>
          <input
            className={styles.inputControl}
            type="number"
            min={0}
            step="0.01"
            value={form.base_deposit_reais}
            onChange={(event) => setForm((prev) => ({ ...prev, base_deposit_reais: event.target.value }))}
            disabled={saving || readOnly}
          />
          <p className={styles.helperText}>Será limitado ao preço padrão.</p>
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Buffer padrão (min)</span>
          <input
            className={styles.inputControl}
            type="number"
            min={0}
            value={form.base_buffer_min}
            onChange={(event) => setForm((prev) => ({ ...prev, base_buffer_min: normalizeMinutes(event.target.value) }))}
            disabled={saving || readOnly}
          />
          <p className={styles.helperText}>Tempo extra antes/depois para todas as opções deste serviço.</p>
        </label>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Ordem</span>
          <input
            className={styles.inputControl}
            type="number"
            min={0}
            value={form.order_index}
            onChange={(event) => setForm((prev) => ({ ...prev, order_index: normalizeOrder(event.target.value) }))}
            disabled={saving || readOnly}
          />
          <p className={styles.helperText}>Serviços com ordem menor aparecem primeiro.</p>
        </label>
        <label className={styles.inputGroup} data-span="2">
          <span className={styles.inputLabel}>Descrição</span>
          <textarea
            className={styles.textareaControl}
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Detalhes do serviço"
            disabled={saving || readOnly}
          />
        </label>
        <label className={`${styles.inputGroup} ${styles.toggleRow}`}>
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
            disabled={saving || readOnly}
          />
          <span className={styles.inputLabel}>Serviço ativo</span>
        </label>
      </div>

      <div className={styles.actionsRow}>
        <button type="submit" className={styles.primaryButton} disabled={saving || readOnly}>
          {saving ? "Salvando..." : mode === "edit" ? "Salvar alterações" : "Criar serviço"}
        </button>
        <Link className={styles.secondaryButton} href="/admin/servicos">
          Cancelar / Voltar
        </Link>
      </div>
      <p className={styles.helperText}>A criação e edição de serviços agora usam rotas dedicadas.</p>
    </form>
  );
}
