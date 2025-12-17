import type { ReactNode } from "react";

import styles from "./admin-ui.module.css";

type AdminToolbarProps = {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  children?: ReactNode;
  actions?: ReactNode;
};

export function AdminToolbar({ searchPlaceholder, searchValue, onSearchChange, children, actions }: AdminToolbarProps) {
  return (
    <div className={styles.toolbar}>
      {searchPlaceholder ? (
        <label className={styles.toolbarSearch}>
          <span aria-hidden>🔍</span>
          <input
            className={styles.toolbarInput}
            placeholder={searchPlaceholder}
            value={searchValue ?? ""}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
        </label>
      ) : null}
      {children}
      {actions ? <div className={styles.toolbarActions}>{actions}</div> : null}
    </div>
  );
}
