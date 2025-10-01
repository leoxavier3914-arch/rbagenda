"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/db";

type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
};

export default function AuthHeader() {
  const [role, setRole] = useState<"loading" | "admin" | "client">("loading");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    const loadRole = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      const session = data.session;
      if (!session?.user?.id) {
        setRole("client");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!active) return;

      setRole(profile?.role === "admin" ? "admin" : "client");
    };

    void loadRole();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const navigationLinks = useMemo<NavLink[]>(() => {
    if (role === "admin") {
      return [
        { href: "/admin", label: "Administração", exact: true },
        { href: "/dashboard/novo-agendamento", label: "Novo agendamento" },
        { href: "/dashboard/agendamentos", label: "Meus agendamentos" },
      ];
    }

    if (role === "client") {
      return [
        { href: "/dashboard", label: "Meu perfil", exact: true },
        { href: "/dashboard/novo-agendamento", label: "Novo agendamento" },
        { href: "/dashboard/agendamentos", label: "Meus agendamentos" },
      ];
    }

    return [];
  }, [role]);

  if (navigationLinks.length === 0) {
    return (
      <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 text-sm text-emerald-900">
          <span className="h-5 w-24 animate-pulse rounded-full bg-emerald-100" aria-hidden />
          <span className="h-5 w-12 animate-pulse rounded-full bg-emerald-100" aria-hidden />
        </div>
      </header>
    );
  }

  const renderLink = (link: NavLink, isMobile = false) => {
    const isActive = link.exact
      ? pathname === link.href
      : pathname === link.href || pathname.startsWith(`${link.href}/`);

    const baseClasses = "rounded-full font-medium transition-colors";

    if (isMobile) {
      return (
        <Link
          key={`${link.href}-mobile`}
          href={link.href}
          className={`${baseClasses} block px-4 py-2 text-base ${
            isActive
              ? "bg-emerald-600 text-white"
              : "text-emerald-800 hover:bg-emerald-50"
          }`}
        >
          {link.label}
        </Link>
      );
    }

    return (
      <Link
        key={link.href}
        href={link.href}
        className={`${baseClasses} px-4 py-2 text-sm ${
          isActive
            ? "bg-emerald-600 text-white"
            : "text-emerald-800 hover:bg-emerald-50"
        }`}
      >
        {link.label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href={role === "admin" ? "/admin" : "/dashboard"}
          className="flex items-center gap-2 text-lg font-semibold text-emerald-900 transition hover:text-emerald-700"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold uppercase tracking-[0.15em] text-white">
            AC
          </span>
          <span className="hidden sm:inline">Agenda de Cílios</span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Navegação principal">
          {navigationLinks.map((link) => renderLink(link))}
        </nav>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 md:hidden"
          onClick={() => setIsMobileOpen((open) => !open)}
          aria-expanded={isMobileOpen}
          aria-controls="mobile-menu"
        >
          {isMobileOpen ? "Fechar" : "Menu"}
        </button>
      </div>

      <div
        id="mobile-menu"
        className={`${
          isMobileOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        } grid transition-all duration-200 ease-out md:hidden`}
      >
        <div className="overflow-hidden border-t border-emerald-100 bg-white/95 px-6 py-3">
          <nav className="flex flex-col gap-1" aria-label="Navegação móvel">
            {navigationLinks.map((link) => renderLink(link, true))}
          </nav>
        </div>
      </div>
    </header>
  );
}
