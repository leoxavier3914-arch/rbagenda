import styles from "../suporte.module.css";
import type { SupportChannel } from "../types";

export type SupportChannelsListProps = {
  channels: SupportChannel[];
};

export function SupportChannelsList({ channels }: SupportChannelsListProps) {
  return (
    <ul className={styles.list}>
      {channels.map((channel) => (
        <li key={channel.label} className={styles.item}>
          <span className={styles.itemLabel}>{channel.label}</span>
          <div className={styles.itemValueWrapper}>
            <span className={styles.itemValue}>{channel.value}</span>
            {channel.helper ? <span className={styles.itemHelper}>{channel.helper}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
