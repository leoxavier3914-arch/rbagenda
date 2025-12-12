import Link from "next/link";

import { supabase } from "@/lib/db";

import styles from "./suporteList.module.css";

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminSuportePage() {
  const { data: threads, error } = await supabase
    .from("support_threads")
    .select("id, user_id, last_message_preview, last_actor, updated_at, profiles(name, email)")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar threads de suporte", error.message);
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Atendimento</p>
        <h2 className={styles.title}>Tickets de suporte</h2>
        <p className={styles.subtitle}>
          Consulte as conversas abertas com clientes. Clique em um ticket para visualizar o histórico e responder como equipe de suporte.
        </p>
      </header>

      <div className={styles.list}>
        {threads && threads.length > 0 ? (
          threads.map((thread) => (
            <Link key={thread.id} href={`/admin/suporte/${thread.id}`} className={styles.card}>
              <div className={styles.cardHeader}>
                {(() => {
                  const profile = Array.isArray(thread.profiles) ? thread.profiles[0] : thread.profiles;

                  return (
                    <div>
                      <p className={styles.clientName}>{profile?.name || "Cliente"}</p>
                      <p className={styles.clientEmail}>{profile?.email || "Sem e-mail"}</p>
                    </div>
                  );
                })()}
                <span className={styles.updatedAt}>{formatDate(thread.updated_at)}</span>
              </div>

              <p className={styles.preview}>{thread.last_message_preview || "Sem mensagens"}</p>

              <p className={styles.lastActor}>
                Última mensagem: {thread.last_actor === "staff" ? "equipe" : "cliente"}
              </p>
            </Link>
          ))
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Nenhum ticket encontrado</p>
            <p className={styles.emptySubtitle}>Quando um cliente abrir uma conversa, ela aparecerá aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}
