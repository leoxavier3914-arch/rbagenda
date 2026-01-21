"use client";

import type { ReactNode } from "react";

import styles from "./ClientContent.module.css";

type ClientContentProps = {
  children: ReactNode;
  disableContentPadding?: boolean;
  fullBleedContent?: boolean;
};

export default function ClientContent({
  children,
  disableContentPadding = false,
  fullBleedContent = false,
}: ClientContentProps) {
  const contentClassName = [
    styles.content,
    disableContentPadding ? styles.contentNoPadding : "",
  ]
    .filter(Boolean)
    .join(" ");

  const contentInnerClassName = [
    styles.contentInner,
    fullBleedContent ? styles.contentInnerFullBleed : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={contentClassName}>
      <div className={contentInnerClassName}>{children}</div>
    </main>
  );
}
