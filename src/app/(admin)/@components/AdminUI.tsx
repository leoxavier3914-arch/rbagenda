"use client";

import type { ReactNode } from "react";
import styles from "../adminUi.module.css";

type AdminCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  variant?: "surface" | "muted" | "ghost";
  padded?: boolean;
};

export function AdminCard({ title, description, actions, children, variant = "surface", padded = true }: AdminCardProps) {
  return (
    <section className={`${styles.card} ${styles[`card-${variant}`]}`}>
      {(title || description || actions) && (
        <header className={styles.cardHeader}>
          <div className={styles.cardHeaderText}>
            {title ? <h3 className={styles.cardTitle}>{title}</h3> : null}
            {description ? <p className={styles.cardDescription}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.cardActions}>{actions}</div> : null}
        </header>
      )}
      <div className={padded ? styles.cardBody : styles.cardBodyFlush}>{children}</div>
    </section>
  );
}

type AdminStatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

export function AdminStatCard({ label, value, icon, hint, tone = "neutral" }: AdminStatCardProps) {
  return (
    <div className={`${styles.statCard} ${styles[`stat-${tone}`]}`}>
      <div className={styles.statHeader}>
        {icon ? <span className={styles.statIcon}>{icon}</span> : null}
        <span className={styles.statLabel}>{label}</span>
      </div>
      <div className={styles.statValue}>{value}</div>
      {hint ? <p className={styles.statHint}>{hint}</p> : null}
    </div>
  );
}

type AdminToolbarProps = {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: ReactNode;
  actions?: ReactNode;
};

export function AdminToolbar({ searchPlaceholder, searchValue, onSearchChange, filters, actions }: AdminToolbarProps) {
  return (
    <div className={styles.toolbar}>
      {searchPlaceholder ? (
        <label className={styles.toolbarSearch}>
          <span className="sr-only">{searchPlaceholder}</span>
          <input
            type="search"
            value={searchValue}
            placeholder={searchPlaceholder}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
        </label>
      ) : (
        <div />
      )}
      <div className={styles.toolbarRight}>
        {filters ? <div className={styles.toolbarFilters}>{filters}</div> : null}
        {actions ? <div className={styles.toolbarActions}>{actions}</div> : null}
      </div>
    </div>
  );
}

type Alignment = "left" | "center" | "right";

type Column<RowKey extends string> = {
  key: RowKey;
  label: string;
  align?: Alignment;
};

type Row<RowKey extends string> = Record<RowKey, ReactNode>;

type AdminTableProps<RowKey extends string> = {
  columns: Column<RowKey>[];
  rows: Row<RowKey>[];
  emptyMessage?: string;
};

export function AdminTable<RowKey extends string>({ columns, rows, emptyMessage }: AdminTableProps<RowKey>) {
  return (
    <div className={styles.table}>
      <div className={styles.tableScroller}>
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} style={{ textAlign: column.align ?? "left" }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key} style={{ textAlign: column.align ?? "left" }}>
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && emptyMessage ? <p className={styles.tableEmpty}>{emptyMessage}</p> : null}
    </div>
  );
}

type AdminFormSectionProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
};

export function AdminFormSection({ title, description, actions, children, aside }: AdminFormSectionProps) {
  return (
    <section className={styles.formSection}>
      <div className={styles.formSectionHeader}>
        <div>
          <p className={styles.formSectionEyebrow}>Formulário</p>
          <h3 className={styles.formSectionTitle}>{title}</h3>
          {description ? <p className={styles.formSectionDescription}>{description}</p> : null}
          {actions ? <div className={styles.formSectionActions}>{actions}</div> : null}
        </div>
        {aside ? <div className={styles.formSectionAside}>{aside}</div> : null}
      </div>
      <div className={styles.formSectionBody}>{children}</div>
    </section>
  );
}
