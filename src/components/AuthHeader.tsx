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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
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
    })();

    return () => {
      active = false;
    };
  }, []);

  const pathname = usePathname();

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }

    document.body.style.overflow = "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [pathname, isMenuOpen]);

  const navigationLinks = useMemo<NavLink[]>(() => {
    if (role === "admin") {
      return [
        { href: "/admin", label: "Administração", exact: true },
        {
          href: "/dashboard/novo-agendamento",
          label: "Novo agendamento",
        },
        {
          href: "/dashboard/agendamentos",
          label: "Meus agendamentos",
        },
      ];
    }

    if (role === "client") {
      return [
        { href: "/dashboard", label: "Meu perfil", exact: true },
        {
          href: "/dashboard/novo-agendamento",
          label: "Novo agendamento",
        },
        {
          href: "/dashboard/agendamentos",
          label: "Meus agendamentos",
        },
      ];
    }

    return [];
  }, [role]);

  if (navigationLinks.length === 0) {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between rounded-full border border-[rgba(47,109,79,0.22)] bg-[rgba(255,255,255,0.78)] px-4 py-2.5 text-[var(--brand-forest)] shadow-[var(--shadow-soft)] backdrop-blur-xl">
          <Link
            href={role === "admin" ? "/admin" : "/dashboard"}
            className="flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-[rgba(47,109,79,0.9)] transition hover:text-[var(--brand-forest-dark)]"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(47,109,79,0.2)] bg-white/70 text-base font-bold">
              RB
            </span>
            Agenda
          </Link>

          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-expanded={isMenuOpen}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(47,109,79,0.25)] bg-[rgba(255,255,255,0.92)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(47,109,79,0.85)] shadow-[var(--shadow-soft)] backdrop-blur-lg transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(149,181,155,0.6)]"
            aria-label="Abrir menu de navegação"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(47,109,79,0.12)] text-lg leading-none">☰</span>
            Menu
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-30 bg-[rgba(13,27,20,0.6)] backdrop-blur-sm transition-opacity duration-300 ${
          isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-full max-w-[min(420px,92vw)] flex-col overflow-hidden border-r border-[rgba(255,255,255,0.25)] bg-[rgba(33,68,51,0.7)] shadow-[0_32px_80px_-30px_rgba(15,31,23,0.65)] backdrop-blur-2xl transition-transform duration-300 ease-out sm:inset-y-4 sm:left-6 sm:rounded-[32px] sm:border sm:border-white/30 ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="relative flex h-full flex-col overflow-hidden">
          <div className="flex items-start justify-between px-6 pb-4 pt-8 sm:px-8">
            <div className="space-y-2 text-white">
              <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                Navegação
              </span>
              <p className="text-2xl font-semibold leading-tight">Escolha onde quer ir</p>
              <p className="text-sm text-white/70">
                Explore as páginas do painel com um toque. O menu funciona tanto no desktop quanto no celular.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="ml-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/20 text-xl font-semibold text-white shadow-[0_10px_30px_rgba(15,31,23,0.35)] transition hover:bg-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              aria-label="Fechar menu"
            >
              ×
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-6 pb-10 sm:px-8">
            {navigationLinks.map((link) => {
              const isActive = link.exact
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`group flex items-center gap-4 rounded-2xl px-5 py-4 text-base font-medium tracking-wide transition-colors ${
                    isActive
                      ? "border border-white/40 bg-white/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                      : "border border-transparent text-white/90 hover:border-white/20 hover:bg-white/10"
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white transition ${
                      isActive
                        ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                        : "group-hover:bg-white/25"
                    }`}
                  >
                    {getLinkIcon(link.href)}
                  </span>
                  <div className="flex flex-col">
                    <span>{link.label}</span>
                    <span className="text-xs font-normal uppercase tracking-[0.28em] text-white/60">
                      {role === "admin" ? "Painel" : "Conta"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}

function getLinkIcon(href: string) {
  const iconProps = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    className: "h-5 w-5",
    "aria-hidden": true,
  } as const;

  switch (href) {
    case "/dashboard":
      return (
        <svg {...iconProps}>
          <path
            d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3 0-9 1.5-9 5v1h18v-1c0-3.5-6-5-9-5Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/dashboard/novo-agendamento":
      return (
        <svg {...iconProps}>
          <path
            d="M6 6V4m12 2V4m-9 9h6m9 7V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12m20 0H2m20 0a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M12 10v8m-4-4h8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "/dashboard/agendamentos":
      return (
        <svg {...iconProps}>
          <path
            d="M8 6V4m8 2V4m-9 9h10M5 21h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/admin":
      return (
        <svg {...iconProps}>
          <path
            d="M12 3 3 7v6c0 5 4 8 9 8s9-3 9-8V7l-9-4Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9 12a3 3 0 0 0 6 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps}>
          <path d="M4 12h16" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 4v16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
