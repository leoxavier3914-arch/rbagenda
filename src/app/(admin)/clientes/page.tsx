import AdminPlaceholderSection from "../@components/AdminPlaceholderSection";

export default function AdminClientesPage() {
  return (
    <AdminPlaceholderSection
      title="Clientes"
      subtitle="Centralize informações e contato dos clientes recorrentes."
      actions={[{ href: "/admin/admin", label: "Ver base de clientes", icon: "🧑‍🤝‍🧑" }]}
    />
  );
}
