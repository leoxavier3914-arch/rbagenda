import type { ReactNode } from "react";

import styles from "./admin-ui.module.css";

type AdminTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
};

type AdminTableRow = {
  key: string;
  cells: ReactNode[];
};

type AdminTableProps = {
  columns: AdminTableColumn[];
  rows: AdminTableRow[];
  emptyMessage?: string;
};

export function AdminTable({ columns, rows, emptyMessage }: AdminTableProps) {
  if (rows.length === 0 && emptyMessage) {
    return <div className={styles.emptyState}>{emptyMessage}</div>;
  }

  return (
    <div className={styles.tableWrapper} role="table">
      <table className={styles.table}>
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
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => (
                <td key={`${row.key}-${columns[index]?.key ?? index}`} style={{ textAlign: columns[index]?.align ?? "left" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
