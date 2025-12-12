"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { useClientSessionGuard } from "@/hooks/useClientSessionGuard"
import { supabase } from "@/lib/db"
import type { Session } from "@supabase/supabase-js"

import styles from "../suporte.module.css"
import type { SupportMessage, SupportThread } from "../types"

type SupportChatProps = {
  session?: Session | null
  isSessionReady?: boolean
}

const MESSAGE_PREVIEW_LIMIT = 120

export function SupportChat({ session: providedSession, isSessionReady }: SupportChatProps) {
  const guard = useClientSessionGuard()
  const session = useMemo(() => providedSession ?? guard.session, [guard.session, providedSession])
  const ready = useMemo(() => (isSessionReady !== undefined ? isSessionReady : guard.isReady), [guard.isReady, isSessionReady])

  const [thread, setThread] = useState<SupportThread | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const ensureThreadAndMessages = async () => {
      if (!ready) return
      if (!session?.user?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const { data: existingThread, error: threadError } = await supabase
          .from("support_threads")
          .select("*")
          .eq("user_id", session.user.id)
          .in("status", ["open", "escalated"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (threadError) throw threadError

        let targetThread = existingThread

        if (!targetThread) {
          const { data: newThread, error: insertError } = await supabase
            .from("support_threads")
            .insert({
              user_id: session.user.id,
              status: "open",
            })
            .select("*")
            .single()

          if (insertError) throw insertError
          targetThread = newThread
        }

        if (!active) return

        setThread(targetThread)

        const { data: messageRows, error: messagesError } = await supabase
          .from("support_messages")
          .select("*")
          .eq("thread_id", targetThread.id)
          .order("created_at", { ascending: true })

        if (messagesError) throw messagesError
        if (!active) return

        setMessages(messageRows ?? [])
      } catch (err) {
        console.error("Erro ao carregar o chat de suporte", err)
        if (active) {
          setError("Não foi possível carregar o chat agora. Tente novamente em instantes.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void ensureThreadAndMessages()

    return () => {
      active = false
    }
  }, [ready, session?.user?.id])

  const handleSend = async () => {
    if (!thread || !session?.user?.id) return
    const trimmed = inputValue.trim()
    if (!trimmed) return

    setSending(true)
    setError(null)

    try {
      const { data: insertedMessage, error: insertError } = await supabase
        .from("support_messages")
        .insert({
          thread_id: thread.id,
          sender_type: "user",
          message: trimmed,
        })
        .select("*")
        .single()

      if (insertError) throw insertError

      const preview = trimmed.slice(0, MESSAGE_PREVIEW_LIMIT)

      await supabase
        .from("support_threads")
        .update({
          last_message_preview: preview,
          last_actor: "user",
        })
        .eq("id", thread.id)

      setMessages((prev) => (insertedMessage ? [...prev, insertedMessage] : prev))
      setInputValue("")
    } catch (err) {
      console.error("Erro ao enviar mensagem de suporte", err)
      setError("Não foi possível enviar a mensagem agora. Tente novamente.")
    } finally {
      setSending(false)
    }
  }

  const disabled = sending || loading

  return (
    <div className={styles.chat}>
      <div className={styles.chatHeader}>
        <h3>Chat de suporte</h3>
        <p className={styles.subtitle}>
          Envie sua dúvida aqui. Responderemos o mais breve possível.
        </p>
      </div>

      {!ready ? (
        <p className={styles.chatEmptyState}>Carregando sessão...</p>
      ) : !session?.user ? (
        <p className={styles.chatEmptyState}>
          Faça login para usar o chat de suporte. <Link href="/login">Ir para login</Link>
        </p>
      ) : (
        <>
          {loading ? (
            <p className={styles.chatEmptyState}>Carregando seu histórico...</p>
          ) : error ? (
            <p className={styles.chatEmptyState}>{error}</p>
          ) : (
            <div className={styles.chatMessages}>
              {messages.length === 0 ? (
                <p className={styles.chatEmptyState}>
                  Nenhuma mensagem ainda. Envie sua dúvida para começar.
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.chatMessageRow} ${msg.sender_type === "user" ? styles.chatMessageUser : styles.chatMessageStaff}`}
                  >
                    <span>{msg.message}</span>
                    <span className={styles.chatTimestamp}>
                      {new Date(msg.created_at).toLocaleString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          <div className={styles.chatInputRow}>
            <textarea
              className={styles.chatInput}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Digite sua mensagem"
              rows={2}
              disabled={disabled || !thread}
            />
            <button
              className={styles.chatSendButton}
              type="button"
              onClick={handleSend}
              disabled={disabled || !thread || !inputValue.trim()}
            >
              {sending ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
