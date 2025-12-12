import AdminPlaceholderSection from "../@components/AdminPlaceholderSection";

export default function AdminTiposPage() {
  return (
    <AdminPlaceholderSection
      title="Tipos"
      subtitle="Organize os serviços em categorias para melhorar a navegação."
      actions={[{ href: "/admin/admin", label: "Reclassificar serviços", icon: "🗂️" }]}
    />
  );
}
