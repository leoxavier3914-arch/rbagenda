import type { ReactNode } from "react";
import AuthHeader from "@/components/AuthHeader";

export default function ClientLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <AuthHeader />

      <div className="relative mx-auto w-full max-w-5xl flex-1 px-6 pb-16 pt-0">

        {children}
      </div>
    </div>
  );
}
