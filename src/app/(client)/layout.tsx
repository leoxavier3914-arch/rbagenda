"use client";

import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import ClientFullScreenLayout from "@/components/ClientFullScreenLayout";
import { LavaLampProvider } from "@/components/LavaLampProvider";

const procedimentoRoutes = [
  "/",
  "/login",
  "/signup",
  "/indice",
  "/agendamentos",
  "/procedimento",
  "/checkout",
  "/configuracoes",
  "/suporte",
  "/meu-perfil",
  "/regras",
];

export default function ClientLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const currentPath = pathname ?? "";
    const isProcedimentoScreen =
      currentPath === "" ||
      procedimentoRoutes.some(
        (route) => currentPath === route || currentPath.startsWith(`${route}/`),
      );

    if (isProcedimentoScreen) {
      document.body.classList.add("procedimento-screen");
    } else {
      document.body.classList.remove("procedimento-screen");
    }

    return () => {
      document.body.classList.remove("procedimento-screen");
    };
  }, [pathname, procedimentoRoutes]);
  const routesWithoutShell = ["/checkout"];

  const shouldHideMenu = routesWithoutShell.some((route) =>
    pathname?.startsWith(route),
  );

  if (shouldHideMenu) {
    return (
      <LavaLampProvider>
        <div className="relative flex min-h-screen flex-1 flex-col">{children}</div>
      </LavaLampProvider>
    );
  }

  return (
    <LavaLampProvider>
      <ClientFullScreenLayout>{children}</ClientFullScreenLayout>
    </LavaLampProvider>
  );
}
