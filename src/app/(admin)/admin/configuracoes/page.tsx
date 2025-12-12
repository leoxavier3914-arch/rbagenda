import AdminPlaceholderSection from "../../@components/AdminPlaceholderSection";

export default function AdminConfiguracoesPage() {
  return (
    <AdminPlaceholderSection
      title="Configurações"
      subtitle="Ajustes finos do painel, integrações e políticas."
      actions={[{ href: "/admin/operacoes", label: "Abrir painel atual", icon: "⚙️" }]}
    />
  );
}
