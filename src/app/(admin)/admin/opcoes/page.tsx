"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";

import {
  type CategoryOption,
  type NormalizedOption,
  type ServiceTypeOption,
  fetchCategories,
  fetchOptionsList,
  fetchServiceTypes,
  formatPriceLabel,
} from "./shared";
import { useAdminGuard } from "../../useAdminGuard";
import styles from "./opcoes.module.css";

export default function OpcoesPage() {
  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);
  const [options, setOptions] = useState<NormalizedOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isSuper = role === "adminsuper" || role === "adminmaster";
  const isReadonly = role === "admin";

  useEffect(() => {
    if (status !== "authorized") return;
    void loadData();
  }, [status]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [categoriesResponse, serviceTypesResponse, optionsResponse] = await Promise.all([
      fetchCategories(),
      fetchServiceTypes(),
      fetchOptionsList(),
    ]);

    if (categoriesResponse.error || serviceTypesResponse.error || optionsResponse.error) {
      setError("Não foi possível carregar as opções.");
      setCategories([]);
      setServiceTypes([]);
      setOptions([]);
      setLoading(false);
      return;
    }

    setCategories(categoriesResponse.data);
    setServiceTypes(serviceTypesResponse.data);
    setOptions(optionsResponse.data);
    setLoading(false);
  };

  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return options
      .filter((option) => {
        if (onlyActive && option.active === false) return false;
        if (categoryFilter && !option.categoryIds.includes(categoryFilter)) return false;
        if (serviceFilter && !option.serviceTypeIds.includes(serviceFilter)) return false;
        if (normalizedSearch.length) {
          const matchesName = option.name.toLowerCase().includes(normalizedSearch);
          const matchesSlug = (option.slug ?? "").toLowerCase().includes(normalizedSearch);
          const matchesService = option.serviceTypeNames.some((name) => name.toLowerCase().includes(normalizedSearch));
          if (!matchesName && !matchesSlug && !matchesService) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [categoryFilter, onlyActive, options, search, serviceFilter]);

  const handleDelete = async (optionId: string) => {
    if (!isSuper) return;
    const target = options.find((option) => option.id === optionId);
    if (!target) return;
    const confirmation = window.confirm(`Excluir a opção “${target.name}”? Esta ação remove os vínculos.`);
    if (!confirmation) return;

    setDeletingId(optionId);
    setError(null);

    const { error: assignmentError } = await supabase
      .from("service_type_assignments")
      .delete()
      .eq("service_id", optionId);

    if (assignmentError) {
      setError("Não foi possível remover os vínculos da opção.");
      setDeletingId(null);
      return;
    }

    const { error: deleteError } = await supabase.from("services").delete().eq("id", optionId);
    if (deleteError) {
      setError("Não foi possível excluir a opção.");
      setDeletingId(null);
      return;
    }

    await loadData();
    setDeletingId(null);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Opções</p>
          <h1 className={styles.title}>Gerencie as opções com rotas dedicadas</h1>
          <p className={styles.subtitle}>
            Visualize, personalize ou remova opções. A criação e edição acontecem em rotas próprias para evitar estados mistos.
          </p>
          {!isSuper ? <span className={styles.tag}>Modo somente leitura</span> : null}
        </div>
        <Link className={styles.primaryButton} href="/admin/opcoes/nova">
          + Nova opção
        </Link>
      </header>

      <section className={styles.listCard}>
        <div className={styles.listHeader}>
          <div>
            <p className={styles.eyebrow}>Lista de opções</p>
            <h2 className={styles.cardTitle}>Todas as opções cadastradas</h2>
            <p className={styles.cardDescription}>
              Filtre diretamente aqui no topo. Use as ações para editar dados, personalizar por serviço ou excluir a opção e seus vínculos.
            </p>
          </div>
          <div className={styles.filterRow}>
            <input
              className={styles.inputControl}
              placeholder="Buscar por nome, slug ou serviço"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={loading}
            />
            <select
              className={styles.selectControl}
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              disabled={loading}
            >
              <option value="">Categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              className={styles.selectControl}
              value={serviceFilter}
              onChange={(event) => setServiceFilter(event.target.value)}
              disabled={loading}
            >
              <option value="">Serviço</option>
              {serviceTypes.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <label className={styles.toggleRow}>
              <input type="checkbox" checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} disabled={loading} />
              <span>Somente ativas</span>
            </label>
          </div>
        </div>

        {error ? <div className={styles.helperText}>{error}</div> : null}

        {loading ? (
          <div className={styles.helperText}>Carregando opções...</div>
        ) : filteredOptions.length ? (
          <div className={styles.optionGrid}>
            {filteredOptions.map((option) => (
              <article key={option.id} className={styles.optionCard}>
                <div className={styles.optionHeader}>
                  <div>
                    <p className={styles.eyebrow}>{option.slug || "sem-slug"}</p>
                    <h3 className={styles.optionTitle}>{option.name}</h3>
                    <p className={styles.muted}>{option.description || "Sem descrição"}</p>
                  </div>
                  <span className={`${styles.badge} ${option.active ? styles.badgeActive : styles.badgeInactive}`}>
                    {option.active ? "Ativa" : "Inativa"}
                  </span>
                </div>

                <div className={styles.pillGroup}>
                  <span className={styles.pill}>
                    {option.assignments.length} {option.assignments.length === 1 ? "serviço vinculado" : "serviços vinculados"}
                  </span>
                  {option.categoryNames.length ? (
                    option.categoryNames.map((categoryName) => (
                      <span key={categoryName} className={styles.pillMuted}>
                        {categoryName}
                      </span>
                    ))
                  ) : (
                    <span className={styles.pillMuted}>Sem categoria</span>
                  )}
                </div>

                <div className={styles.assignmentList}>
                  {option.assignments.length ? (
                    option.assignments.map((assignment) => (
                      <div key={`${option.id}-${assignment.serviceTypeId}`} className={styles.assignmentRow}>
                        <div>
                          <p className={styles.assignmentTitle}>{assignment.serviceTypeName}</p>
                          <p className={styles.assignmentMeta}>
                            {assignment.useDefaults ? "Padrão do serviço" : "Personalizado"} · {assignment.final.duration} min ·{" "}
                            {formatPriceLabel(assignment.final.price)} · Sinal {formatPriceLabel(assignment.final.deposit)} · Buffer{" "}
                            {assignment.final.buffer} min
                          </p>
                        </div>
                        <span className={`${styles.badge} ${assignment.active ? styles.badgeActive : styles.badgeInactive}`}>
                          {assignment.active ? "Serviço ativo" : "Serviço inativo"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className={styles.helperText}>Nenhum serviço vinculado.</p>
                  )}
                </div>

                <div className={styles.actionRow}>
                  <Link className={styles.secondaryButton} href={`/admin/opcoes/${option.id}/editar`}>
                    Editar
                  </Link>
                  <Link className={styles.secondaryButton} href={`/admin/opcoes/${option.id}/personalizar`}>
                    Personalizar
                  </Link>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => handleDelete(option.id)}
                    disabled={isReadonly || deletingId === option.id}
                  >
                    {deletingId === option.id ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>Nenhuma opção encontrada com os filtros atuais.</div>
        )}
      </section>
    </div>
  );
}
