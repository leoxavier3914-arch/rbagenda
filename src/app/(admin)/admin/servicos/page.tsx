"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";

import { useAdminGuard } from "../../useAdminGuard";
import styles from "./servicos.module.css";
import {
  type CategoryOption,
  type NormalizedService,
  fetchCategories,
  fetchServicesList,
  formatPriceLabel,
} from "./shared";

type StatusFilter = "all" | "active" | "inactive";

export default function ServicosPage() {
  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [services, setServices] = useState<NormalizedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [groupByCategory, setGroupByCategory] = useState(true);
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

    const [categoriesResponse, servicesResponse] = await Promise.all([fetchCategories(), fetchServicesList()]);

    if (categoriesResponse.error || servicesResponse.error) {
      setError("Não foi possível carregar os serviços.");
      setCategories([]);
      setServices([]);
      setLoading(false);
      return;
    }

    setCategories(categoriesResponse.data);
    setServices(
      servicesResponse.data.sort((a, b) => {
        if (a.order_index !== b.order_index) return a.order_index - b.order_index;
        return a.name.localeCompare(b.name, "pt-BR");
      })
    );
    setLoading(false);
  };

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return services.filter((service) => {
      if (categoryFilter && service.category_id !== categoryFilter) return false;
      if (statusFilter === "active" && !service.active) return false;
      if (statusFilter === "inactive" && service.active) return false;
      if (normalizedSearch.length) {
        const matchesName = service.name.toLowerCase().includes(normalizedSearch);
        const matchesSlug = (service.slug ?? "").toLowerCase().includes(normalizedSearch);
        if (!matchesName && !matchesSlug) return false;
      }
      return true;
    });
  }, [categoryFilter, search, services, statusFilter]);

  const groupedServices = useMemo(() => {
    const groups = new Map<string, { label: string; items: NormalizedService[]; order: number }>();
    filteredServices.forEach((service) => {
      const key = service.category_id ?? "sem-categoria";
      const categoryMeta = categories.find((cat) => cat.id === service.category_id);
      const label = service.category_name ?? categoryMeta?.name ?? "Sem categoria";
      const order = categoryMeta?.order_index ?? Number.POSITIVE_INFINITY;
      if (!groups.has(key)) {
        groups.set(key, { label, items: [], order });
      }
      groups.get(key)?.items.push(service);
    });

    return Array.from(groups.entries())
      .map(([key, value]) => ({
        key,
        ...value,
        items: value.items.sort((a, b) => a.order_index - b.order_index),
      }))
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label, "pt-BR");
      });
  }, [categories, filteredServices]);

  const handleDelete = async (serviceId: string) => {
    if (!isSuper) {
      setError("Apenas Master ou Super podem excluir serviços.");
      return;
    }
    const target = services.find((service) => service.id === serviceId);
    const confirmation = window.confirm(`Excluir o serviço “${target?.name ?? "Serviço"}”?`);
    if (!confirmation) return;

    setDeletingId(serviceId);
    setError(null);

    const { error: deleteError } = await supabase.from("service_types").delete().eq("id", serviceId);
    if (deleteError) {
      setError("Não foi possível excluir o serviço. Verifique dependências e permissões.");
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
          <p className={styles.eyebrow}>Serviços</p>
          <h1 className={styles.title}>Gerencie serviços com rotas dedicadas</h1>
          <p className={styles.subtitle}>
            Listagem separada de criação e edição, seguindo o mesmo padrão de Opções. Filtros de nome, categoria e status ficam aqui.
          </p>
          {!isSuper ? <span className={styles.tag}>Modo somente leitura</span> : null}
        </div>
        <Link className={styles.primaryButton} href="/admin/servicos/novo">
          + Novo serviço
        </Link>
      </header>

      <section className={styles.listCard}>
        <div className={styles.listHeader}>
          <div>
            <p className={styles.eyebrow}>Lista de serviços</p>
            <h2 className={styles.cardTitle}>Visualize, filtre e acesse ações rápidas</h2>
            <p className={styles.cardDescription}>Nenhum formulário é exibido aqui. Criação e edição agora vivem em rotas próprias.</p>
          </div>
          <div className={styles.filterRow}>
            <input
              className={styles.inputControl}
              placeholder="Buscar por nome ou slug"
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
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              className={styles.selectControl}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              disabled={loading}
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
            <label className={`${styles.toggleRow} ${styles.groupToggle}`}>
              <input type="checkbox" checked={groupByCategory} onChange={(event) => setGroupByCategory(event.target.checked)} disabled={loading} />
              <span>Agrupar por categoria</span>
            </label>
          </div>
        </div>

        {error ? <div className={styles.helperText}>{error}</div> : null}

        {loading ? (
          <div className={styles.helperText}>Carregando serviços...</div>
        ) : filteredServices.length === 0 ? (
          <div className={styles.emptyState}>Nenhum serviço encontrado com os filtros atuais.</div>
        ) : groupByCategory ? (
          <div className={styles.groupGrid}>
            {groupedServices.map((group) => (
              <article key={group.key} className={styles.groupCard}>
                <div className={styles.groupHeader}>
                  <h3 className={styles.groupTitle}>{group.label}</h3>
                  <span className={`${styles.badge} ${styles.optionBadge}`}>{group.items.length} serviços</span>
                </div>
                {group.items.map((service) => (
                  <ServiceCard key={service.id} service={service} onDelete={handleDelete} loading={deletingId === service.id} readOnly={isReadonly} />
                ))}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.groupGrid}>
            {filteredServices.map((service) => (
              <ServiceCard key={service.id} service={service} onDelete={handleDelete} loading={deletingId === service.id} readOnly={isReadonly} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type ServiceCardProps = {
  service: NormalizedService;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
  readOnly: boolean;
};

function ServiceCard({ service, onDelete, loading, readOnly }: ServiceCardProps) {
  return (
    <div className={styles.serviceCard}>
      <div className={styles.serviceHeader}>
        <div>
          <p className={styles.meta}>{service.category_name ?? "Sem categoria"}</p>
          <h4 className={styles.serviceTitle}>{service.name}</h4>
          <p className={styles.meta}>{service.slug ?? "Sem slug"}</p>
        </div>
        <span className={`${styles.badge} ${service.active ? styles.badgeActive : styles.badgeInactive}`}>{service.active ? "Ativo" : "Inativo"}</span>
      </div>

      <p className={styles.meta}>{service.description || "Sem descrição"}</p>

      <div className={styles.pillGroup}>
        <span className={styles.pill}>
          Padrão: {service.defaults.duration} min • {formatPriceLabel(service.defaults.price)} • Sinal {formatPriceLabel(service.defaults.deposit)} • Buffer{" "}
          {service.defaults.buffer} min
        </span>
      </div>

      <div className={styles.pillGroup}>
        {service.options.length ? (
          service.options.map((option) => (
            <span key={option} className={styles.pill}>
              {option}
            </span>
          ))
        ) : (
          <span className={styles.pillMuted}>Nenhuma opção vinculada</span>
        )}
      </div>

      <div className={styles.actions}>
        <Link href={`/admin/opcoes?servico=${service.id}`} className={styles.secondaryButton} aria-label={`Gerenciar opções para ${service.name}`}>
          Gerenciar opções
        </Link>
        <Link href={`/admin/servicos/${service.id}/editar`} className={styles.secondaryButton}>
          Editar
        </Link>
        <button
          type="button"
          className={`${styles.secondaryButton} ${styles.dangerButton}`}
          onClick={() => onDelete(service.id)}
          disabled={readOnly || loading}
        >
          {loading ? "Excluindo..." : "Excluir"}
        </button>
      </div>
    </div>
  );
}
