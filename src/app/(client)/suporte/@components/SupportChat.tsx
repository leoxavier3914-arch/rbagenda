"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  const clampPosition = (nextX: number, nextY: number) => {
    const panel = panelRef.current
    const width = panel?.offsetWidth ?? 360
    const height = panel?.offsetHeight ?? 520
    const margin = 16

    const maxX = window.innerWidth - width - margin
    const maxY = window.innerHeight - height - margin

    return {
      x: Math.min(Math.max(margin, nextX), Math.max(margin, maxX)),
      y: Math.min(Math.max(margin, nextY), Math.max(margin, maxY)),
    }
  }

  useEffect(() => {
    if (!isOpen) return
    if (position) return

    const panel = panelRef.current
    if (!panel) return

    const syncPosition = () => {
      const rect = panel.getBoundingClientRect()
      const margin = 16
      const nextX = window.innerWidth - rect.width - margin
      const nextY = window.innerHeight - rect.height - margin
      setPosition(clampPosition(nextX, nextY))
    }

    const raf = window.requestAnimationFrame(syncPosition)
    return () => window.cancelAnimationFrame(raf)
  }, [isOpen, position])

  useEffect(() => {
    if (!dragging) return

    const handleMove = (event: PointerEvent) => {
      setPosition((prev) => {
        const nextX = event.clientX - dragOffset.current.x
        const nextY = event.clientY - dragOffset.current.y
        return clampPosition(nextX, nextY)
      })
    }

    const handleUp = () => {
      setDragging(false)
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)

    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [dragging])

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

      const resolveLatestBranch = async () => {
        const { data, error } = await supabase
          .from("appointments")
          .select("branch_id")
          .eq("customer_id", session.user.id)
          .not("branch_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error("Erro ao buscar última filial do cliente", error)
          return null
        }

        return data?.branch_id ?? null
      }

      try {
        const latestBranchId = await resolveLatestBranch()
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
              branch_id: latestBranchId ?? null,
            })
            .select("*")
            .single()

          if (insertError) throw insertError
          targetThread = newThread
        } else if (!targetThread.branch_id && latestBranchId) {
          const { error: attachBranchError } = await supabase
            .from("support_threads")
            .update({ branch_id: latestBranchId })
            .eq("id", targetThread.id)

          if (!attachBranchError) {
            targetThread = { ...targetThread, branch_id: latestBranchId }
          }
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
          updated_at: new Date().toISOString(),
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

  const openChat = () => {
    setIsOpen(true)
    setIsMinimized(false)
  }

  const closeChat = () => {
    setIsOpen(false)
    setIsMinimized(false)
  }

  const toggleMinimize = () => {
    setIsMinimized((prev) => !prev)
  }

  const handleDragStart = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    setDragging(true)
  }

  return (
    <div className={styles.chatRoot}>
      <button className={styles.chatLauncher} type="button" onClick={openChat}>
        CHAT
      </button>

      {isOpen ? (
        isMinimized ? (
          <button
            ref={panelRef}
            className={styles.chatMinimizedButton}
            type="button"
            onClick={openChat}
            onPointerDown={handleDragStart}
            style={
              position
                ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" }
                : undefined
            }
            aria-label="Abrir chat de suporte"
          >
            💬
          </button>
        ) : (
          <div
            ref={panelRef}
            className={styles.chatFloating}
            style={
              position
                ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" }
                : undefined
            }
          >
            <div className={styles.chatHeader} onPointerDown={handleDragStart}>
              <div className={styles.chatHeaderInfo}>
                <span className={styles.chatHeaderTitle}>Chat de suporte</span>
                <span className={styles.chatHeaderStatus}>Online agora</span>
              </div>
              <div className={styles.chatHeaderActions}>
                <button
                  className={styles.chatHeaderButton}
                  type="button"
                  onClick={toggleMinimize}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  Minimizar
                </button>
                <button
                  className={styles.chatHeaderButton}
                  type="button"
                  onClick={closeChat}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className={styles.chatBody}>
              <p className={styles.chatSubtitle}>
                Envie sua dúvida aqui. Responderemos o mais breve possível.
              </p>

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
                    <div className={styles.chatInputTools}>
                      <button className={styles.chatToolButton} type="button" aria-label="Anexar imagem">
                        📎
                      </button>
                      <button className={styles.chatToolButton} type="button" aria-label="Inserir emoji">
                        😊
                      </button>
                    </div>
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
          </div>
        )
      ) : null}
    </div>
  )
}
