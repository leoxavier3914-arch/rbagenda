import AdminPlaceholderSection from "../@components/AdminPlaceholderSection";

export default function AdminServicosPage() {
  return (
    <AdminPlaceholderSection
      title="Serviços"
      subtitle="Mantenha o catálogo alinhado com os preços e durações corretas."
      actions={[{ href: "/admin/admin", label: "Editar serviços", icon: "💼" }]}
    />
  );
}
