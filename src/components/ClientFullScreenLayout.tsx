"use client";

import { useEffect, type ReactNode } from "react";

import ClientMenu from "./ClientMenu";
import styles from "./ClientFullScreenLayout.module.css";

type ClientFullScreenLayoutProps = {
  children: ReactNode;
};

const BODY_CLASS = "client-fullscreen";

export default function ClientFullScreenLayout({
  children,
}: ClientFullScreenLayoutProps) {
  useEffect(() => {
    const body = document.body;
    body.classList.add(BODY_CLASS);

    return () => {
      body.classList.remove(BODY_CLASS);
    };
  }, []);

  return (
    <div className={styles.fullscreenWrapper}>
      <ClientMenu>{children}</ClientMenu>
    </div>
  );
}
