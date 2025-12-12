import AdminPlaceholderSection from "../../@components/AdminPlaceholderSection";

export default function AdminSuportePage() {
  return (
    <AdminPlaceholderSection
      title="Suporte"
      subtitle="Espaço reservado para threads e mensagens do time."
      actions={[{ href: "/admin/operacoes", label: "Voltar ao painel", icon: "↩" }]}
    />
  );
}
