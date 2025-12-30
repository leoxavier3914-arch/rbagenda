"use client";

import { useEffect, useState } from "react";

import { OptionForm } from "../OptionForm";
import { type CategoryOption, type ServiceTypeOption, fetchCategories, fetchServiceTypes } from "../shared";
import { useAdminGuard } from "../../../useAdminGuard";
import styles from "./nova.module.css";

export default function NovaOpcaoPage() {
  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);
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
    const [categoriesResponse, serviceTypesResponse] = await Promise.all([fetchCategories(), fetchServiceTypes()]);

    if (categoriesResponse.error || serviceTypesResponse.error) {
      setError("Não foi possível carregar categorias e serviços.");
      setCategories([]);
      setServiceTypes([]);
      setLoading(false);
      return;
    }

    setCategories(categoriesResponse.data);
    setServiceTypes(serviceTypesResponse.data);
    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Opções · Nova</p>
          <h1 className={styles.title}>Criar nova opção com vínculo obrigatório</h1>
          <p className={styles.subtitle}>
            Cadastre a opção, vincule a pelo menos um serviço e já deixe overrides finais quando necessário. Todo o fluxo acontece neste cartão.
          </p>
          {isReadonly ? <span className={styles.tag}>Somente leitura para admins</span> : null}
        </div>
      </header>

      {error ? <div className={styles.helperText}>{error}</div> : null}
      {loading ? (
        <div className={styles.helperText}>Carregando dados iniciais...</div>
      ) : (
        <OptionForm mode="create" categories={categories} serviceTypes={serviceTypes} styles={styles} readOnly={isReadonly} />
      )}
    </div>
  );
}
