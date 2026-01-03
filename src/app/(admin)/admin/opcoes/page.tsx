"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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

type OverlayState = {
  optionId: string | null;
  anchorEl: HTMLElement | null;
};

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
  const [overlayState, setOverlayState] = useState<OverlayState>({ optionId: null, anchorEl: null });

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

    handleCloseOverlay();
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
    handleCloseOverlay();
    setDeletingId(null);
  };

  const handleOverlayToggle = (optionId: string, target: HTMLElement) => {
    const anchor = (target.closest("article") as HTMLElement | null) ?? target;
    setOverlayState((previous) => {
      const isSame = previous.optionId === optionId;
      return isSame ? { optionId: null, anchorEl: null } : { optionId, anchorEl: anchor };
    });
  };

  const handleCloseOverlay = () => {
    setOverlayState({ optionId: null, anchorEl: null });
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
              <article
                key={option.id}
                className={`${styles.optionCard} ${overlayState.optionId === option.id ? styles.optionCardExpanded : ""}`}
                onClick={(event) => handleOverlayToggle(option.id, event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOverlayToggle(option.id, event.currentTarget);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className={styles.optionHeader}>
                  <div>
                    <p className={styles.eyebrow}>
                      {option.categoryNames.length ? option.categoryNames.join(" · ") : "Sem categoria"}
                    </p>
                    <h3 className={styles.optionTitle}>{option.name}</h3>
                    <p className={styles.muted}>{option.description || "Sem descrição"}</p>
                  </div>
                  <span className={`${styles.badge} ${option.active ? styles.badgeActive : styles.badgeInactive}`}>
                    {option.active ? "Ativa" : "Inativa"}
                  </span>
                </div>

                <div className={styles.metaRow}>
                  <button
                    type="button"
                    className={`${styles.pill} ${overlayState.optionId === option.id ? styles.pillActive : ""}`}
                    aria-expanded={overlayState.optionId === option.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOverlayToggle(option.id, event.currentTarget);
                    }}
                  >
                    <span>
                      {option.assignments.length} {option.assignments.length === 1 ? "serviço vinculado" : "serviços vinculados"}
                    </span>
                    <span className={styles.expandIcon}>{overlayState.optionId === option.id ? "▲" : "▼"}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>Nenhuma opção encontrada com os filtros atuais.</div>
        )}
      </section>
      {overlayState.optionId && overlayState.anchorEl
        ? (() => {
            const overlayOption =
              options.find((current) => current.id === overlayState.optionId) ??
              filteredOptions.find((current) => current.id === overlayState.optionId);
            if (!overlayOption) return null;
            return (
              <OptionOverlay
                option={overlayOption}
                anchorEl={overlayState.anchorEl}
                onClose={handleCloseOverlay}
                onDelete={handleDelete}
                isReadonly={isReadonly}
                deletingId={deletingId}
              />
            );
          })()
        : null}
    </div>
  );
}

type OptionOverlayProps = {
  option: NormalizedOption;
  anchorEl: HTMLElement;
  onClose: () => void;
  onDelete: (optionId: string) => void;
  isReadonly: boolean;
  deletingId: string | null;
};

function OptionOverlay({ option, anchorEl, onClose, onDelete, isReadonly, deletingId }: OptionOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 0 });

  const updatePosition = useCallback(() => {
    if (!anchorEl || !overlayRef.current) return;
    const baseAnchor = (anchorEl.closest("article") as HTMLElement | null) ?? anchorEl;
    const rect = baseAnchor.getBoundingClientRect();
    const overlayWidth = rect.width;
    const overlayHeight = overlayRef.current.offsetHeight;

    const maxLeft = Math.max(8, window.innerWidth - overlayWidth - 8);
    const clampedLeft = Math.min(Math.max(rect.left, 8), maxLeft);
    let top = rect.bottom + 8;
    if (top + overlayHeight > window.innerHeight) {
      top = rect.top - overlayHeight - 8;
    }

    setPosition({ left: clampedLeft, top, width: overlayWidth });
  }, [anchorEl]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
  }, [updatePosition]);

  useEffect(() => {
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const baseAnchor = (anchorEl.closest("article") as HTMLElement | null) ?? anchorEl;
      if (overlayRef.current?.contains(target)) return;
      if (baseAnchor?.contains(target)) return;
      onClose();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [anchorEl, onClose, updatePosition]);

  return createPortal(
    <>
      <div className={styles.overlayBackdrop} />
      <div
        ref={overlayRef}
        className={styles.overlayPanel}
        style={{ left: position.left, top: position.top, width: position.width }}
        role="dialog"
        aria-label={`Vínculos da opção ${option.name}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className={styles.overlayHeader}>
          <div>
            <p className={styles.eyebrow}>{option.categoryNames.length ? option.categoryNames.join(" · ") : "Sem categoria"}</p>
            <h3 className={styles.optionTitle}>{option.name}</h3>
          </div>
          <span className={`${styles.badge} ${option.active ? styles.badgeActive : styles.badgeInactive}`}>
            {option.active ? "Ativa" : "Inativa"}
          </span>
        </div>

        <div className={styles.assignmentList}>
          {option.assignments.length ? (
            option.assignments.map((assignment) => (
              <div key={`${option.id}-${assignment.serviceTypeId}`} className={styles.assignmentRow}>
                <div>
                  <p className={styles.assignmentTitle}>{assignment.serviceTypeName}</p>
                  <p className={styles.assignmentMeta}>
                    {assignment.useDefaults ? "Padrão" : "Personalizado"} · {assignment.final.duration} min · {formatPriceLabel(assignment.final.price)} ·
                    Sinal {formatPriceLabel(assignment.final.deposit)} · Buffer {assignment.final.buffer} min
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
            onClick={() => onDelete(option.id)}
            disabled={isReadonly || deletingId === option.id}
          >
            {deletingId === option.id ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
