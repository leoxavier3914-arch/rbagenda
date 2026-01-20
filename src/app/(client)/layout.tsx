"use client";

import type { ReactNode } from "react";

import ClientAppShell from "@/components/ClientAppShell";
import { LavaLampProvider } from "@/components/LavaLampProvider";

export default function ClientLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <LavaLampProvider>
      <ClientAppShell>{children}</ClientAppShell>
    </LavaLampProvider>
  );
}
