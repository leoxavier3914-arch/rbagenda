"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import ClientFullScreenLayout from "@/components/ClientFullScreenLayout";
import { LavaLampProvider } from "@/components/LavaLampProvider";

export default function ClientLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const routesWithoutShell = ["/checkout"];

  const shouldHideMenu = routesWithoutShell.some((route) =>
    pathname?.startsWith(route),
  );

  if (shouldHideMenu) {
    return (
      <LavaLampProvider>
        <div className="relative flex min-h-[100dvh] w-screen flex-1 flex-col">
          {children}
        </div>
      </LavaLampProvider>
    );
  }

  return (
    <LavaLampProvider>
      <ClientFullScreenLayout>{children}</ClientFullScreenLayout>
    </LavaLampProvider>
  );
}
