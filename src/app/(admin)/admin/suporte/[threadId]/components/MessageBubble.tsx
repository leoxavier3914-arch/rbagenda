import styles from "../threadView.module.css";

type MessageBubbleProps = {
  message: string;
  sender_type: "user" | "staff" | "assistant";
};

export default function MessageBubble({ message, sender_type }: MessageBubbleProps) {
  const isStaff = sender_type !== "user";
  const rowClass = isStaff ? styles.bubbleStaff : styles.bubbleUser;
  const bubbleClass = isStaff ? styles.staffBubble : styles.userBubble;

  return (
    <div className={`${styles.bubbleRow} ${rowClass}`}>
      <div className={`${styles.bubble} ${bubbleClass}`}>{message}</div>
    </div>
  );
}
