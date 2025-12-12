import AdminPlaceholderSection from "../@components/AdminPlaceholderSection";

export default function AdminAgendamentosPage() {
  return (
    <AdminPlaceholderSection
      title="Agendamentos"
      subtitle="Visão dedicada para triagem e histórico das reservas."
      actions={[{ href: "/admin/admin", label: "Abrir painel de operações", icon: "🛠️" }]}
    />
  );
}
