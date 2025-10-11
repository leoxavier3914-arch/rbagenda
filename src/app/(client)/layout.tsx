"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import AppShell from "@/components/AppShell";

export default function ClientLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const routesWithoutShell = [
    "/checkout",
    "/dashboard/novo-agendamento",
  ];

  const shouldHideMenu = routesWithoutShell.some((route) =>
    pathname?.startsWith(route),
  );

  if (shouldHideMenu) {
    return <div className="relative flex min-h-screen flex-1 flex-col">{children}</div>;
  }

  return <AppShell>{children}</AppShell>;
}
