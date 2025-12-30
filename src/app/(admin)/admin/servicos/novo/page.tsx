"use client";

import { useEffect, useState } from "react";

import { ServiceForm } from "../ServiceForm";
import { type CategoryOption, fetchCategories } from "../shared";
import { useAdminGuard } from "../../../useAdminGuard";
import styles from "../form.module.css";

export default function NovoServicoPage() {
  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isReadonly = role === "admin";

  useEffect(() => {
    if (status !== "authorized") return;
    void loadBase();
  }, [status]);

  const loadBase = async () => {
    setLoading(true);
    setError(null);

    const categoriesResponse = await fetchCategories();
    if (categoriesResponse.error) {
      setError("Não foi possível carregar categorias.");
      setCategories([]);
      setLoading(false);
      return;
    }

    setCategories(categoriesResponse.data);
    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Serviços · Novo</p>
          <h1 className={styles.title}>Criar novo serviço</h1>
          <p className={styles.subtitle}>Cadastre o serviço e mantenha os vínculos de opções intactos. Fluxo dedicado, sem lista.</p>
          {isReadonly ? <span className={styles.tag}>Somente leitura para admins</span> : null}
        </div>
      </header>

      {error ? <div className={styles.helperText}>{error}</div> : null}
      {loading ? (
        <div className={styles.helperText}>Carregando dados iniciais...</div>
      ) : (
        <ServiceForm mode="create" categories={categories} styles={styles} readOnly={isReadonly} />
      )}
    </div>
  );
}
