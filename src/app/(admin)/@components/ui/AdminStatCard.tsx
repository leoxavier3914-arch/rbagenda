import type { ReactNode } from "react";

import styles from "./admin-ui.module.css";

type AdminStatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
};

export function AdminStatCard({ label, value, hint, icon }: AdminStatCardProps) {
  return (
    <div className={styles.statCard}>
      <div className="flex items-center justify-between gap-2">
        <p className={styles.statLabel}>{label}</p>
        {icon ? <span className="text-lg" aria-hidden>{icon}</span> : null}
      </div>
      <p className={styles.statValue}>{value}</p>
      {hint ? <p className={styles.statHint}>{hint}</p> : null}
    </div>
  );
}
