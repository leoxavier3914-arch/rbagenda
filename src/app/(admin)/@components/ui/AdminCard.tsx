import type { ReactNode } from "react";

import styles from "./admin-ui.module.css";

type AdminCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  variant?: "default" | "muted" | "ghost";
  className?: string;
};

export function AdminCard({ title, description, actions, children, variant = "default", className }: AdminCardProps) {
  const variantClass =
    variant === "muted" ? styles.cardMuted : variant === "ghost" ? styles.cardGhost : undefined;

  return (
    <section className={`${styles.card} ${variantClass ?? ""} ${className ?? ""}`}>
      {(title || description || actions) && (
        <header className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            {title ? <h3 className={styles.cardTitle}>{title}</h3> : null}
            {description ? <p className={styles.cardDescription}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.cardActions}>{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
