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

type RoleState = {
  role: "admin" | "client";
  isLoading: boolean;
};

const defaultLinks: NavLink[] = [
  { href: "/dashboard", label: "Meu perfil", exact: true },
  { href: "/dashboard/novo-agendamento", label: "Novo agendamento" },
  { href: "/dashboard/agendamentos", label: "Meus agendamentos" },
];

export default function AuthHeader() {
  const [roleState, setRoleState] = useState<RoleState>({
    role: "client",
    isLoading: true,
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    const loadRole = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        const session = data.session;
        if (!session?.user?.id) {
          setRoleState({ role: "client", isLoading: false });
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!active) return;

        setRoleState({
          role: profile?.role === "admin" ? "admin" : "client",
          isLoading: false,
        });
      } catch (error) {
        console.error("Falha ao carregar o papel do usuário", error);
        if (!active) return;
        setRoleState({ role: "client", isLoading: false });
      }
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
    if (roleState.role === "admin") {
      return [
        { href: "/admin", label: "Administração", exact: true },
        { href: "/dashboard/novo-agendamento", label: "Novo agendamento" },
        { href: "/dashboard/agendamentos", label: "Meus agendamentos" },
      ];
    }

    return defaultLinks;
  }, [roleState.role]);

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
    <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 shadow-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href={roleState.role === "admin" ? "/admin" : "/dashboard"}
          className="flex items-center gap-2 text-lg font-semibold text-emerald-900 transition hover:text-emerald-700"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold uppercase tracking-[0.15em] text-white">
            AC
          </span>
          <span className="hidden sm:inline">Agenda de Cílios</span>
        </Link>

        <nav
          className={`hidden items-center gap-2 md:flex ${
            roleState.isLoading ? "animate-pulse" : ""
          }`}
          aria-label="Navegação principal"
        >
          {navigationLinks.map((link) => renderLink(link))}
        </nav>

        <button
          type="button"
          className="inline-flex h-11 w-11 flex-col items-center justify-center gap-1 rounded-full border border-emerald-200 text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 md:hidden"
          onClick={() => setIsMobileOpen((open) => !open)}
          aria-expanded={isMobileOpen}
          aria-controls="mobile-menu"
        >
          <span className="sr-only">{isMobileOpen ? "Fechar menu" : "Abrir menu"}</span>
          <span
            aria-hidden
            className={`${
              isMobileOpen
                ? "translate-y-[7px] rotate-45 opacity-80"
                : "-translate-y-[6px]"
            } block h-0.5 w-6 origin-center rounded-full bg-emerald-700 transition-transform duration-200 ease-out`}
          />
          <span
            aria-hidden
            className={`${
              isMobileOpen ? "opacity-0" : "opacity-80"
            } block h-0.5 w-6 rounded-full bg-emerald-700 transition-opacity duration-200 ease-out`}
          />
          <span
            aria-hidden
            className={`${
              isMobileOpen
                ? "-translate-y-[7px] -rotate-45 opacity-80"
                : "translate-y-[6px]"
            } block h-0.5 w-6 origin-center rounded-full bg-emerald-700 transition-transform duration-200 ease-out`}
          />
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
