"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/db";

import styles from "../threadView.module.css";

type MessageInputProps = {
  threadId: string;
  onMessageSent?: (message: {
    id: string;
    thread_id: string;
    sender_type: "user" | "staff" | "assistant";
    message: string;
    created_at: string;
  }) => void;
};

export default function MessageInput({ threadId, onMessageSent }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setIsSending(true);

    const { data: sessionResult } = await supabase.auth.getSession();
    const adminId = sessionResult?.session?.user?.id || null;

    const { data: insertedMessage, error: messageError } = await supabase
      .from("support_messages")
      .insert({
        thread_id: threadId,
        sender_type: "staff",
        sender_id: adminId,
        message: trimmed,
      })
      .select("id, thread_id, sender_type, message, created_at")
      .single();

    if (!messageError) {
      await supabase
        .from("support_threads")
        .update({
          last_message_preview: trimmed,
          last_actor: "staff",
          updated_at: new Date().toISOString(),
        })
        .eq("id", threadId);

      setContent("");
      if (insertedMessage) {
        onMessageSent?.(insertedMessage);
      }
      router.refresh();
    }

    setIsSending(false);
  }

  return (
    <form className={styles.inputBar} onSubmit={handleSubmit}>
      <label htmlFor="support-reply" className="sr-only">
        Responder ticket
      </label>
      <textarea
        id="support-reply"
        className={styles.textarea}
        placeholder="Escreva uma resposta para o cliente"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={isSending}
      />
      <button type="submit" className={styles.sendButton} disabled={isSending}>
        {isSending ? "Enviando..." : "Enviar"}
      </button>
    </form>
  );
}
