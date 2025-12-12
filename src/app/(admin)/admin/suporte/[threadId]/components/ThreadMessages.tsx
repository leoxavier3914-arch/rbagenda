import MessageBubble from "./MessageBubble";

import styles from "../threadView.module.css";

type SupportMessage = {
  id: string;
  sender_type: "user" | "staff";
  content: string;
};

type ThreadMessagesProps = {
  messages: SupportMessage[];
};

export default function ThreadMessages({ messages }: ThreadMessagesProps) {
  if (!messages || messages.length === 0) {
    return <p className={styles.emptyMessage}>Nenhuma mensagem neste ticket ainda.</p>;
  }

  return (
    <div className={styles.messageList}>
      {messages.map((message) => (
        <MessageBubble key={message.id} content={message.content} sender_type={message.sender_type} />
      ))}
    </div>
  );
}
