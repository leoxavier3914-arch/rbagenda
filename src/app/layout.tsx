import { headers } from "next/headers";
import type { Metadata } from "next";
import "./globals.css";
import "./procedimento.css";

export const metadata: Metadata = {
  title: "Agenda de Cílios",
  description: "Plataforma de agendamento com pagamentos e lembretes automáticos.",
  manifest: "/manifest.webmanifest",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  appleWebApp: {
    capable: true,
    title: "Agenda de Cílios",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();

  const currentPath =
    headerList.get("x-invoke-path") ??
    headerList.get("x-matched-path") ??
    headerList.get("next-url") ??
    "";

  const clientShellRoutes = [
    "/",
    "/indice",
    "/agendamentos",
    "/procedimento",
    "/checkout",
    "/configuracoes",
    "/suporte",
    "/meu-perfil",
    "/regras",
  ];

  const isClientShellRoute = clientShellRoutes.some(
    (route) => currentPath === route || currentPath.startsWith(`${route}/`),
  );

  const bodyClasses = ["flex min-h-screen flex-col"];

  if (isClientShellRoute) {
    bodyClasses.push("client-fullscreen");
  }

  return (
    <html lang="pt-BR">
      <body className={bodyClasses.join(" ")}>
        <div className="brand-texture-overlay pointer-events-none fixed inset-0 -z-10" aria-hidden />
        <div className="relative flex min-h-screen flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
