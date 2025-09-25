import type { ReactNode } from "react";
import AuthHeader from "@/components/AuthHeader";

export default function ClientLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-white">
      <AuthHeader />
      <div className="pb-10">{children}</div>
    </div>
  );
}
