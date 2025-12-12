import { SupportChannelsList } from "./SupportChannelsList"
import { SupportChat } from "./SupportChat"
import type { SupportChannel } from "../types"
import styles from "../suporte.module.css"
import type { Session } from "@supabase/supabase-js"

type SupportContentProps = {
  session?: Session | null
  isSessionReady?: boolean
}

const supportChannels: SupportChannel[] = [
  { label: "WhatsApp", value: "Em breve", helper: "Canal direto com o estúdio" },
  { label: "E-mail", value: "Em breve", helper: "Para dúvidas, alterações ou suporte" },
  { label: "Horário", value: "Em breve", helper: "Atendimento em horário comercial" },
]

export function SupportContent({ session, isSessionReady }: SupportContentProps) {
  return (
    <div className={styles.content}>
      <SupportChannelsList channels={supportChannels} />
      <SupportChat session={session} isSessionReady={isSessionReady} />
    </div>
  )
}
