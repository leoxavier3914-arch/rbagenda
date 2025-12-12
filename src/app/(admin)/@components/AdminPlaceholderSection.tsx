import Link from "next/link";

import styles from "../adminPlaceholder.module.css";

type AdminPlaceholderSectionProps = {
  title: string;
  subtitle: string;
  actions?: Array<{ href: string; label: string; icon?: string }>;
};

export default function AdminPlaceholderSection({ title, subtitle, actions = [] }: AdminPlaceholderSectionProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.heading}>
        <p className={styles.title}>{title}</p>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      <div className={styles.card}>
        <span className={styles.badge}>Em breve</span>
        <p className={styles.subtitle}>
          Este módulo ainda não possui telas dedicadas, mas já conta com acesso seguro e o mesmo visual das páginas do cliente.
        </p>
        {actions.length > 0 ? (
          <div className={styles.actions}>
            {actions.map((action) => (
              <Link key={action.href} href={action.href} className={styles.actionButton}>
                <span aria-hidden>{action.icon ?? "↗"}</span>
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
