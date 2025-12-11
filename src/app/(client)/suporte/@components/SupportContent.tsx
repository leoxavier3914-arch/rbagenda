import { SupportChannelsList } from "./SupportChannelsList";
import type { SupportChannel } from "../types";
import styles from "../suporte.module.css";

const supportChannels: SupportChannel[] = [
  { label: "WhatsApp", value: "Em breve", helper: "Canal direto com o estúdio" },
  { label: "E-mail", value: "Em breve", helper: "Para dúvidas, alterações ou suporte" },
  { label: "Horário", value: "Em breve", helper: "Atendimento em horário comercial" },
];

export function SupportContent() {
  return (
    <div className={styles.content}>
      <SupportChannelsList channels={supportChannels} />
    </div>
  );
}
