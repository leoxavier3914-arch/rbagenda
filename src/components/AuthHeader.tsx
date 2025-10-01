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
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-between px-4 pt-4 sm:px-6">
        <div className="pointer-events-auto">
          <Link
            href={role === "admin" ? "/admin" : "/dashboard"}
            className="sr-only"
          >
            Voltar para a página inicial do painel
          </Link>

          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-expanded={isMenuOpen}
            className="inline-flex items-center gap-3 rounded-2xl border border-white/40 bg-[rgba(31,138,112,0.82)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[0_24px_60px_-24px_rgba(21,75,60,0.75)] backdrop-blur-2xl transition hover:bg-[rgba(31,138,112,0.95)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,255,255,0.7)]"
            aria-label="Abrir menu de navegação"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/10 text-lg leading-none">
              ☰
            </span>
            Menu
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-30 bg-[rgba(12,38,30,0.55)] backdrop-blur-md transition-opacity duration-300 ${
          isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-full max-w-[min(420px,92vw)] flex-col overflow-hidden border-r border-[rgba(255,255,255,0.32)] bg-[rgba(31,138,112,0.32)] shadow-[0_40px_90px_-32px_rgba(12,46,35,0.65)] backdrop-blur-2xl transition-transform duration-300 ease-out sm:inset-y-4 sm:left-6 sm:rounded-[32px] sm:border sm:border-[rgba(255,255,255,0.38)] ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="relative flex h-full flex-col overflow-hidden">
          <div className="flex items-start justify-between px-6 pb-4 pt-8 sm:px-8">
            <div className="space-y-2 text-white">
              <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
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
              className="ml-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/20 text-xl font-semibold text-white shadow-[0_20px_40px_-18px_rgba(12,46,35,0.45)] transition hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
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
                      ? "border border-[rgba(255,255,255,0.45)] bg-[rgba(31,138,112,0.4)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                      : "border border-transparent text-white/85 hover:border-white/25 hover:bg-[rgba(255,255,255,0.08)]"
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white transition ${
                      isActive
                        ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] bg-[rgba(31,138,112,0.45)]"
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
