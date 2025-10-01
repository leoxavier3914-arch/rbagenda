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
        <div className="pointer-events-none mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(47,109,79,0.25)] bg-[rgba(255,255,255,0.78)] text-2xl font-semibold text-[var(--brand-forest)] shadow-[var(--shadow-soft)] backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.95)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(149,181,155,0.6)]"
              aria-label="Abrir menu de navegação"
            >
              ☰
            </button>
          </div>

          <div className="pointer-events-auto hidden rounded-full border border-[rgba(47,109,79,0.2)] bg-[rgba(255,255,255,0.85)] px-4 py-2 text-sm font-medium uppercase tracking-[0.18em] text-[rgba(47,109,79,0.85)] shadow-[var(--shadow-soft)] backdrop-blur-md sm:flex">
            Menu
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-30 bg-[rgba(13,27,20,0.5)] transition-opacity duration-300 ${
          isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] transform border-r border-[rgba(255,255,255,0.32)] bg-[rgba(47,109,79,0.28)] shadow-[0_24px_60px_-20px_rgba(25,55,38,0.6)] backdrop-blur-2xl transition-transform duration-300 ease-out ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative h-full px-6 pb-10 pt-20">
          <button
            type="button"
            onClick={() => setIsMenuOpen(false)}
            className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.7)] text-xl font-semibold text-[rgba(47,109,79,0.8)] shadow-[0_10px_30px_rgba(15,31,23,0.25)] transition hover:bg-[var(--brand-forest)] hover:text-[var(--brand-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,255,255,0.7)]"
            aria-label="Fechar menu"
          >
            ×
          </button>

          <div className="mb-8">
            <span className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.4)] bg-[rgba(255,255,255,0.22)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
              Navegação
            </span>
          </div>

          <nav className="flex flex-col gap-2">
            {navigationLinks.map((link) => {
              const isActive = link.exact
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-colors ${
                    isActive
                      ? "border border-white/40 bg-white/30 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                      : "border border-transparent text-white/90 hover:bg-white/15"
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white transition ${
                      isActive
                        ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                        : "group-hover:bg-white/25"
                    }`}
                  >
                    {getLinkIcon(link.href)}
                  </span>
                  <span>{link.label}</span>
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
