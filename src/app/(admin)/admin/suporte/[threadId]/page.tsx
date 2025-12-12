"use client";

import { useEffect, useMemo, useState } from "react";

import ThreadMessages from "./components/ThreadMessages";
import MessageInput from "./components/MessageInput";
import styles from "./threadView.module.css";

import { supabase } from "@/lib/db";

type ThreadProfile = {
  full_name: string | null;
  name?: string | null;
  email: string | null;
} | null;

type SupportThread = {
  id: string;
  user_id: string | null;
  updated_at: string;
  last_message_preview: string | null;
  last_actor: "user" | "staff" | "assistant" | null;
  profiles: ThreadProfile | ThreadProfile[] | null;
};

type SupportMessage = {
  id: string;
  thread_id: string;
  sender_type: "user" | "staff" | "assistant";
  message: string;
  created_at: string;
};

type ThreadPageProps = {
  params: {
    threadId: string;
  };
};

function extractProfile(profiles: SupportThread["profiles"]): ThreadProfile {
  if (Array.isArray(profiles)) return profiles[0] ?? null;
  return profiles;
}

export default function SupportThreadPage({ params }: ThreadPageProps) {
  const { threadId } = params;
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const loadThread = async () => {
      setIsLoading(true);
      setError(null);

      const { data: threadData, error: threadError } = await supabase
        .from("support_threads")
        .select("id, user_id, updated_at, last_message_preview, last_actor, profiles(full_name, email)")
        .eq("id", threadId)
        .maybeSingle();

      const { data: messageRows, error: messagesError } = await supabase
        .from("support_messages")
        .select("id, thread_id, sender_type, message, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (threadError || messagesError) {
        console.error("Erro ao carregar ticket de suporte", threadError ?? messagesError);
        setError("Não foi possível carregar o ticket agora.");
      } else {
        setThread(threadData ?? null);
        setMessages(messageRows ?? []);
      }

      setIsLoading(false);
    };

    const ensureSessionAndLoad = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session) {
        await loadThread();
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;

        if (nextSession) {
          void loadThread();
          subscription.unsubscribe();
        }
      });

      unsubscribe = subscription.unsubscribe;
    };

    void ensureSessionAndLoad();

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [threadId]);

  const profile = useMemo(() => extractProfile(thread?.profiles ?? null), [thread?.profiles]);

  const handleMessageSent = (message: SupportMessage) => {
    setMessages((prev) => [...prev, message]);
    setThread((prev) => (prev ? { ...prev, last_message_preview: message.message, last_actor: "staff" } : prev));
  };

  return (
    <div className={styles.threadWrapper}>
      <header className={styles.header}>
        <p className={styles.threadMeta}>Atendimento ao cliente</p>
        <h2 className={styles.threadTitle}>Ticket #{thread?.id || threadId}</h2>
        {profile && (
          <p className={styles.threadMeta}>
            Cliente: {profile.full_name || profile.name || "Sem nome"} · {profile.email || "Sem e-mail"}
          </p>
        )}
      </header>

      <section className={styles.messagesPanel}>
        {isLoading ? (
          <p className={styles.emptyMessage}>Carregando mensagens...</p>
        ) : error ? (
          <p className={styles.emptyMessage}>{error}</p>
        ) : (
          <ThreadMessages messages={messages} />
        )}
      </section>

      <MessageInput threadId={threadId} onMessageSent={handleMessageSent} />
    </div>
  );
}
