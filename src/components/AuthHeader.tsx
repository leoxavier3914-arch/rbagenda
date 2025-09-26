"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";

type NavLink = {
  href: string;
  label: string;
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

  const navigationLinks = useMemo<NavLink[]>(() => {
    if (role === "admin") {
      return [
        { href: "/admin", label: "Admin" },
        { href: "/dashboard", label: "Meu perfil" },
        { href: "/dashboard/novo-agendamento", label: "Novo agendamento" },
        { href: "/dashboard/agendamentos", label: "Meus agendamentos" },
      ];
    }

    if (role === "client") {
      return [
        { href: "/dashboard", label: "Meu perfil" },
        { href: "/dashboard/novo-agendamento", label: "Novo agendamento" },
        { href: "/dashboard/agendamentos", label: "Meus agendamentos" },
      ];
    }

    return [];
  }, [role]);

  return (
    <header className="border-b border-[color:rgba(230,217,195,0.6)] bg-gradient-to-r from-[rgba(255,255,255,0.92)] via-[rgba(250,245,232,0.88)] to-[rgba(255,255,255,0.92)] shadow-sm backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-6 py-4">
        <div className="flex flex-col items-center gap-4">
          <span className="rounded-full border border-[color:rgba(47,109,79,0.15)] bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#2f6d4f]/70">
            Agenda
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-[#2f6d4f] sm:gap-4">
            {navigationLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 transition-all hover:bg-[#f7f2e7] hover:text-[#23523a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6d4f]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
