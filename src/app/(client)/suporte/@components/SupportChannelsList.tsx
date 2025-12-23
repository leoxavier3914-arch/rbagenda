import styles from "../suporte.module.css";
import type { SupportChannel } from "../types";

export type SupportChannelsListProps = {
  channels: SupportChannel[];
};

export function SupportChannelsList({ channels }: SupportChannelsListProps) {
  return (
    <div className={styles.actionsList}>
      {channels.map((channel) => {
        const isLink = Boolean(channel.actionHref);
        const Component = isLink ? "a" : "button";
        const componentProps = isLink
          ? { href: channel.actionHref, target: "_blank", rel: "noreferrer" }
          : { type: "button" as const, onClick: channel.onClick, disabled: channel.disabled };

        return (
          <Component
            key={channel.label}
            className={styles.actionCard}
            {...componentProps}
            aria-label={channel.actionLabel ?? channel.label}
          >
            <span className={styles.actionIcon} aria-hidden="true">
              {channel.icon ?? "💬"}
            </span>
            <span className={styles.actionTexts}>
              <span className={styles.actionLabel}>{channel.label}</span>
              <span className={styles.actionValue}>{channel.value}</span>
              {channel.helper ? <span className={styles.actionHelper}>{channel.helper}</span> : null}
            </span>
            {channel.actionLabel ? <span className={styles.actionCta}>{channel.actionLabel}</span> : null}
          </Component>
        )
      })}
    </div>
  );
}
