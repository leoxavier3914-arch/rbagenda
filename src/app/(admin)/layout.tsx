import type { ReactNode } from "react";

import { LavaLampProvider } from "@/components/LavaLampProvider";

import AdminShell from "./@components/AdminShell";
import "./admin.module.css";

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <LavaLampProvider>
      <AdminShell>{children}</AdminShell>
    </LavaLampProvider>
  );
}
