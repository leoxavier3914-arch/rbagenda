"use client";

import { useEffect, useState } from "react";

import { OptionForm } from "../../OptionForm";
import {
  type CategoryOption,
  type NormalizedOption,
  type ServicePhoto,
  type ServiceTypeOption,
  fetchCategories,
  fetchOptionPhotos,
  fetchOptionWithAssignments,
  fetchServiceTypes,
} from "../../shared";
import { useAdminGuard } from "../../../../useAdminGuard";
import styles from "./editar.module.css";

type Params = {
  params: { id: string };
};

export default function EditarOpcaoPage({ params }: Params) {
  const { status, role } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);
  const [option, setOption] = useState<NormalizedOption | null>(null);
  const [photos, setPhotos] = useState<ServicePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const optionId = params.id;
  const isReadonly = role === "admin";

  useEffect(() => {
    if (status !== "authorized" || !optionId) return;
    void loadData(optionId);
  }, [status, optionId]);

  const loadData = async (id: string) => {
    setLoading(true);
    setError(null);

    const [categoriesResponse, serviceTypesResponse, optionResponse, photosResponse] = await Promise.all([
      fetchCategories(),
      fetchServiceTypes(),
      fetchOptionWithAssignments(id),
      fetchOptionPhotos(id),
    ]);

    if (categoriesResponse.error || serviceTypesResponse.error || optionResponse.error || photosResponse.error || !optionResponse.data) {
      setError("Não foi possível carregar a opção selecionada.");
      setCategories([]);
      setServiceTypes([]);
      setOption(null);
      setPhotos([]);
      setLoading(false);
      return;
    }

    setCategories(categoriesResponse.data);
    setServiceTypes(serviceTypesResponse.data);
    setOption(optionResponse.data);
    setPhotos(photosResponse.data);
    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Opções · Editar</p>
          <h1 className={styles.title}>Editar opção e sincronizar vínculos</h1>
          <p className={styles.subtitle}>Atualize dados, serviços vinculados e overrides finais. Salve para manter tudo alinhado.</p>
          {isReadonly ? <span className={styles.tag}>Somente leitura para admins</span> : null}
        </div>
      </header>

      {error ? <div className={styles.helperText}>{error}</div> : null}
      {loading ? (
        <div className={styles.helperText}>Carregando opção e serviços...</div>
      ) : option ? (
        <OptionForm
          mode="edit"
          optionId={optionId}
          categories={categories}
          serviceTypes={serviceTypes}
          initialOption={option}
          initialPhotos={photos}
          styles={styles}
          readOnly={isReadonly}
        />
      ) : (
        <div className={styles.helperTextError}>Opção não encontrada.</div>
      )}
    </div>
  );
}
