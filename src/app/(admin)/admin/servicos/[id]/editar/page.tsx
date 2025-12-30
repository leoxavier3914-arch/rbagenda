"use client";

import { useEffect, useState } from "react";

import { ServiceForm } from "../../ServiceForm";
import { type CategoryOption, type NormalizedService, fetchCategories, fetchServiceById } from "../../shared";
import { useAdminGuard } from "../../../../useAdminGuard";
import styles from "../../form.module.css";

type Params = {
  params: { id: string };
};

export default function EditarServicoPage({ params }: Params) {
  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [service, setService] = useState<NormalizedService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serviceId = params.id;
  const isReadonly = role === "admin";

  useEffect(() => {
    if (status !== "authorized" || !serviceId) return;
    void loadData(serviceId);
  }, [status, serviceId]);

  const loadData = async (id: string) => {
    setLoading(true);
    setError(null);

    const [categoriesResponse, serviceResponse] = await Promise.all([fetchCategories(), fetchServiceById(id)]);

    if (categoriesResponse.error || serviceResponse.error || !serviceResponse.data) {
      setError("Não foi possível carregar o serviço selecionado.");
      setCategories([]);
      setService(null);
      setLoading(false);
      return;
    }

    setCategories(categoriesResponse.data);
    setService(serviceResponse.data);
    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Serviços · Editar</p>
          <h1 className={styles.title}>Editar serviço</h1>
          <p className={styles.subtitle}>Atualize dados do serviço. Vínculos de opções permanecem com a lógica atual.</p>
          {isReadonly ? <span className={styles.tag}>Somente leitura para admins</span> : null}
        </div>
      </header>

      {error ? <div className={styles.helperText}>{error}</div> : null}
      {loading ? (
        <div className={styles.helperText}>Carregando serviço...</div>
      ) : service ? (
        <ServiceForm
          mode="edit"
          serviceId={serviceId}
          categories={categories}
          initialService={service}
          styles={styles}
          readOnly={isReadonly}
        />
      ) : (
        <div className={styles.helperTextError}>Serviço não encontrado.</div>
      )}
    </div>
  );
}
