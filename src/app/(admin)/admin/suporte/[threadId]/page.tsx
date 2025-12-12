import ThreadMessages from "./components/ThreadMessages";
import MessageInput from "./components/MessageInput";
import styles from "./threadView.module.css";

import { supabase } from "@/lib/db";

type ThreadPageProps = {
  params: {
    threadId: string;
  };
};

export default async function SupportThreadPage({ params }: ThreadPageProps) {
  const { threadId } = params;

  const { data: thread } = await supabase
    .from("support_threads")
    .select("id, user_id, updated_at, last_message_preview, last_actor, profiles(name, email)")
    .eq("id", threadId)
    .single();

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, thread_id, sender_type, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  return (
    <div className={styles.threadWrapper}>
      <header className={styles.header}>
        <p className={styles.threadMeta}>Atendimento ao cliente</p>
        <h2 className={styles.threadTitle}>Ticket #{thread?.id}</h2>
        {thread?.profiles && (
          // Supabase retorna arrays para relações; pega o primeiro item se houver.
          (() => {
            const profile = Array.isArray(thread.profiles) ? thread.profiles[0] : thread.profiles;
            if (!profile) return null;

            return (
              <p className={styles.threadMeta}>
                Cliente: {profile.name || "Sem nome"} · {profile.email || "Sem e-mail"}
              </p>
            );
          })()
        )}
      </header>

      <section className={styles.messagesPanel}>
        <ThreadMessages messages={messages || []} />
      </section>

      <MessageInput threadId={threadId} />
    </div>
  );
}
