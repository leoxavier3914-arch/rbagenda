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
      <div className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-14 sm:px-6 sm:py-10 sm:pb-16">
        {children}
      </div>
    </div>
  );
}
