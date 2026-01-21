"use client";

import type { ReactNode } from "react";

import ClientContent from "./ClientContent";
import ClientMenu from "./ClientMenu";
import styles from "./ClientAppShell.module.css";

type ClientAppShellProps = {
  children: ReactNode;
};

export default function ClientAppShell({ children }: ClientAppShellProps) {
  return (
    <div className={styles.shell}>
      <ClientMenu />
      <ClientContent>{children}</ClientContent>
    </div>
  );
}
