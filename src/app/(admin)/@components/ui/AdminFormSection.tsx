import type { ReactNode } from "react";

import styles from "./admin-ui.module.css";

type AdminFormSectionProps = {
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
};

export function AdminFormSection({ title, description, badge, children }: AdminFormSectionProps) {
  return (
    <section className={styles.formSection}>
      <header className={styles.formHeader}>
        <div className="flex items-center gap-3">
          {badge ? <span className={styles.pill}>{badge}</span> : null}
          <h3 className={styles.formTitle}>{title}</h3>
        </div>
        {description ? <p className={styles.formDescription}>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
