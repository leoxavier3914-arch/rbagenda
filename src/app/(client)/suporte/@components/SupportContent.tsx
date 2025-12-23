import { SupportChannelsList } from "./SupportChannelsList"
import { SupportChat } from "./SupportChat"
import type { SupportChannel } from "../types"
import styles from "../suporte.module.css"
import type { Session } from "@supabase/supabase-js"

type SupportContentProps = {
  session?: Session | null
  isSessionReady?: boolean
}

export function SupportContent({ session, isSessionReady }: SupportContentProps) {
  return (
    <div className={styles.content}>
      <SupportChat
        session={session}
        isSessionReady={isSessionReady}
        renderLauncher={({ openChat, isOpen }) => {
          const supportChannels: SupportChannel[] = [
            {
              label: "WhatsApp",
              value: "Atendimento rápido com o estúdio",
              actionHref: "https://wa.me/",
              icon: "📱",
            },
            {
              label: "E-mail",
              value: "suporte@rbagenda.com",
              actionHref: "mailto:suporte@rbagenda.com",
              icon: "✉️",
            },
            {
              label: "Chat",
              value: isOpen ? "Chat já está aberto" : "Fale com a equipe agora",
              icon: "💬",
              onClick: openChat,
            },
          ]

          return <SupportChannelsList channels={supportChannels} />
        }}
      />
    </div>
  )
}
