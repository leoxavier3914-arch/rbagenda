"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import ClientMenu from "./ClientMenu";
import styles from "./ClientFullScreenLayout.module.css";

type ClientFullScreenLayoutProps = {
  children: ReactNode;
};

const BODY_CLASS = "client-fullscreen";
const DISABLE_PADDING_ROUTES = [
  "/agendamentos",
  "/procedimento",
];

export default function ClientFullScreenLayout({
  children,
}: ClientFullScreenLayoutProps) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const body = document.body;
    body.classList.add(BODY_CLASS);

    return () => {
      body.classList.remove(BODY_CLASS);
    };
  }, []);

  const disableContentPadding = DISABLE_PADDING_ROUTES.some((route) =>
    pathname === route || pathname?.startsWith(`${route}/`),
  );

  return (
    <div className={styles.fullscreenWrapper}>
      <ClientMenu disableContentPadding={disableContentPadding}>{children}</ClientMenu>
    </div>
  );
}
