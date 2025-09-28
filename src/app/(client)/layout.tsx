"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";

export default function ClientLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const shouldHideHeader = pathname?.startsWith("/checkout");

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      {!shouldHideHeader && <AuthHeader />}

      <div className="relative mx-auto w-full max-w-5xl flex-1 px-6 pb-16 pt-0">

        {children}
      </div>
    </div>
  );
}
