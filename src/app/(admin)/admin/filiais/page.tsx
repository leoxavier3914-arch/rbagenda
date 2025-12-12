import AdminPlaceholderSection from "../../@components/AdminPlaceholderSection";

export default function AdminFiliaisPage() {
  return (
    <AdminPlaceholderSection
      title="Filiais"
      subtitle="Cadastre e organize unidades com fuso horário correto."
      actions={[{ href: "/admin/operacoes", label: "Gerenciar filiais no painel", icon: "🏢" }]}
    />
  );
}
