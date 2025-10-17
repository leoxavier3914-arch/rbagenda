import type { Metadata } from "next";
import "./globals.css";

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
    maskIcon: [{ url: "/icons/maskable-icon-512.png", type: "image/png" }],
    shortcut: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col">
        <div className="brand-texture-overlay pointer-events-none fixed inset-0 -z-10" aria-hidden />
        <div className="relative flex min-h-screen flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
