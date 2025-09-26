"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";

export default function AuthHeader() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      setSigningOut(false);
      return;
    }

    router.replace("/login");
    setSigningOut(false);
  }

  return (
    <header className="border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium text-gray-700">
          {role === "admin" ? (
            <>
              <Link href="/admin" className="transition hover:text-black">
                Admin
              </Link>
              <Link
                href="/dashboard/novo-agendamento"
                className="transition hover:text-black"
              >
                Novo agendamento
              </Link>
              <Link
                href="/dashboard/agendamentos"
                className="transition hover:text-black"
              >
                Meus agendamentos
              </Link>
            </>
          ) : role === "client" ? (
            <>
              <Link
                href="/dashboard/novo-agendamento"
                className="transition hover:text-black"
              >
                Novo agendamento
              </Link>
              <Link
                href="/dashboard/agendamentos"
                className="transition hover:text-black"
              >
                Meus agendamentos
              </Link>
            </>
          ) : null}
        </nav>
        <div className="flex flex-col items-end text-right">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded border border-black px-3 py-1 text-sm font-medium text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Saindo…" : "Sair"}
          </button>
          {error ? (
            <span className="mt-1 text-xs text-red-600">{error}</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
