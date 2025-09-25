"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/db";

type Profile = {
  role?: string;
};

export function AppHeader() {
  const [sessionAvailable, setSessionAvailable] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;

      if (!token) {
        setSessionAvailable(false);
        return;
      }

      setSessionAvailable(true);

      try {
        const profile = await fetch(
          `/rest/v1/profiles?id=eq.${sess.session?.user.id}`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        ).then((res) => res.json() as Promise<Profile[]>);

        setRole(profile[0]?.role ?? null);
      } catch (error) {
        console.error("Erro ao carregar perfil", error);
      }
    })();
  }, []);

  const links = useMemo(() => {
    const base = [{ href: "/dashboard", label: "Dashboard" }];
    if (role === "admin") {
      base.push({ href: "/admin", label: "Admin" });
    }
    return base;
  }, [role]);

  if (!sessionAvailable) return null;

  return (
    <header className="border-b bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <nav className="flex items-center gap-4 text-sm font-medium">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`transition-colors hover:text-black ${
                pathname === link.href
                  ? "text-black"
                  : "text-neutral-500"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="rounded border border-neutral-300 px-3 py-1 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-black"
        >
          Sair
        </button>
      </div>
    </header>
  );
}

export default AppHeader;
