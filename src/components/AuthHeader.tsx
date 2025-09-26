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
    <div className="mx-auto w-full max-w-4xl px-0 sm:px-6">
      <nav className="flex min-h-[3.75rem] items-stretch overflow-hidden rounded-none border border-[rgba(47,109,79,0.25)] bg-[rgba(255,255,255,0.82)] shadow-[var(--shadow-soft)] sm:rounded-full">
        {navigationLinks.map((link, index) => {
          const isActive = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-1 items-center justify-center px-4 py-4 text-center text-base font-semibold transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(149,181,155,0.5)] ${
                index > 0 ? "border-l border-[rgba(47,109,79,0.12)]" : ""
              } ${
                isActive
                  ? "bg-[var(--brand-forest)] text-[var(--brand-cream)] shadow-inner"
                  : "text-[var(--brand-forest)] hover:bg-[rgba(247,242,231,0.9)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
