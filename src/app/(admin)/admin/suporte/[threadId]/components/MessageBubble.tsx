import styles from "../threadView.module.css";

type MessageBubbleProps = {
  content: string;
  sender_type: "user" | "staff";
};

export default function MessageBubble({ content, sender_type }: MessageBubbleProps) {
  const isStaff = sender_type === "staff";
  const rowClass = isStaff ? styles.bubbleStaff : styles.bubbleUser;
  const bubbleClass = isStaff ? styles.staffBubble : styles.userBubble;

  return (
    <div className={`${styles.bubbleRow} ${rowClass}`}>
      <div className={`${styles.bubble} ${bubbleClass}`}>{content}</div>
    </div>
  );
}
