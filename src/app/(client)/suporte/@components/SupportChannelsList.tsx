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
          {channel.actionLabel ? (
            channel.actionHref ? (
              <a className={styles.itemAction} href={channel.actionHref} target="_blank" rel="noreferrer">
                {channel.actionLabel}
              </a>
            ) : (
              <button className={styles.itemAction} type="button" disabled>
                {channel.actionLabel}
              </button>
            )
          ) : null}
        </li>
      ))}
    </ul>
  );
}
