"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/db";

import styles from "./suporteList.module.css";

type ThreadProfile = { name: string | null; email: string | null } | null;

type SupportThread = {
  id: string;
  user_id: string | null;
  last_message_preview: string | null;
  last_actor: "user" | "staff" | "assistant" | null;
  updated_at: string;
  profiles: ThreadProfile | ThreadProfile[] | null;
};

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

function getProfileData(profiles: SupportThread["profiles"]): ThreadProfile {
  if (Array.isArray(profiles)) return profiles[0] ?? null;
  return profiles;
}

export default function AdminSuportePage() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadThreads = async () => {
      setIsLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("support_threads")
        .select("id, user_id, last_message_preview, last_actor, updated_at, profiles(name, email)")
        .order("updated_at", { ascending: false });

      if (!active) return;

      if (queryError) {
        console.error("Erro ao carregar threads de suporte", queryError.message);
        setError("Não foi possível carregar os tickets agora.");
        setThreads([]);
      } else {
        setThreads(data ?? []);
      }

      setIsLoading(false);
    };

    void loadThreads();

    return () => {
      active = false;
    };
  }, []);

  const hasThreads = useMemo(() => threads.length > 0, [threads]);

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
        {isLoading ? (
          <p className={styles.emptySubtitle}>Carregando tickets...</p>
        ) : error ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>{error}</p>
            <p className={styles.emptySubtitle}>Tente novamente em instantes.</p>
          </div>
        ) : hasThreads ? (
          threads.map((thread) => {
            const profile = getProfileData(thread.profiles);

            return (
              <Link key={thread.id} href={`/admin/suporte/${thread.id}`} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.clientName}>{profile?.name || "Cliente"}</p>
                    <p className={styles.clientEmail}>{profile?.email || "Sem e-mail"}</p>
                  </div>
                  <span className={styles.updatedAt}>{formatDate(thread.updated_at)}</span>
                </div>

                <p className={styles.preview}>{thread.last_message_preview || "Sem mensagens"}</p>

                <p className={styles.lastActor}>
                  Última mensagem: {thread.last_actor === "staff" ? "equipe" : "cliente"}
                </p>
              </Link>
            );
          })
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
