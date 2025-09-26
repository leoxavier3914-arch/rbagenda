import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agenda de Cílios",
  description: "Plataforma de agendamento com pagamentos e lembretes automáticos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col`}
      >
        <div className="brand-texture-overlay pointer-events-none fixed inset-0 -z-10" aria-hidden />
        <div className="relative flex min-h-screen flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
