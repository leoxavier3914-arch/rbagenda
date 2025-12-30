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
  const [warnings, setWarnings] = useState<string[]>([]);

  const optionId = params.id;
  const isReadonly = role === "admin";

  useEffect(() => {
    if (status !== "authorized" || !optionId) return;
    void loadData(optionId);
  }, [status, optionId]);

  const loadData = async (id: string) => {
    setLoading(true);
    setError(null);
    setWarnings([]);

    const [categoriesResponse, serviceTypesResponse, optionResponse, photosResponse] = await Promise.all([
      fetchCategories(),
      fetchServiceTypes(),
      fetchOptionWithAssignments(id),
      fetchOptionPhotos(id),
    ]);

    if (optionResponse.error || !optionResponse.data) {
      if (optionResponse.error) {
        console.error("Erro ao carregar opção:", optionResponse.error.message ?? optionResponse.error);
      }
      setError(optionResponse.error ? `Erro ao carregar opção: ${optionResponse.error.message ?? "Erro desconhecido"}` : "Opção não encontrada.");
      setCategories([]);
      setServiceTypes([]);
      setOption(null);
      setPhotos([]);
      setLoading(false);
      return;
    }

    const nextWarnings: string[] = [];

    if (categoriesResponse.error) {
      console.error("Erro ao carregar categorias:", categoriesResponse.error.message ?? categoriesResponse.error);
      nextWarnings.push("Erro ao carregar categorias.");
      setCategories([]);
    } else {
      setCategories(categoriesResponse.data);
    }

    if (serviceTypesResponse.error) {
      console.error("Erro ao carregar tipos de serviço:", serviceTypesResponse.error.message ?? serviceTypesResponse.error);
      nextWarnings.push("Erro ao carregar tipos de serviço.");
      setServiceTypes([]);
    } else {
      setServiceTypes(serviceTypesResponse.data);
    }

    if (photosResponse.error) {
      console.error("Erro ao carregar fotos:", photosResponse.error.message ?? photosResponse.error);
      nextWarnings.push("Erro ao carregar fotos.");
      setPhotos([]);
    } else {
      setPhotos(photosResponse.data);
    }

    setOption(optionResponse.data);
    setWarnings(nextWarnings);
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
      {warnings.map((message) => (
        <div key={message} className={styles.helperTextWarning}>
          {message}
        </div>
      ))}
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
