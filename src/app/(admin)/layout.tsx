import type { ReactNode } from "react";

import AdminShell from "./@components/AdminShell";
import { AdminThemeProvider } from "./@components/AdminThemeProvider";
import "./admin.module.css";

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <AdminThemeProvider>
      <AdminShell>{children}</AdminShell>
    </AdminThemeProvider>
  );
}
