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
    <header className="border-b border-[color:rgba(230,217,195,0.6)] bg-[color:rgba(255,255,255,0.75)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <nav className="flex items-center gap-5 text-sm font-medium text-[#2f6d4f]">
          {role === "admin" ? (
            <>
              <Link
                href="/admin"
                className="rounded-full px-3 py-1 transition hover:bg-[#f7f2e7] hover:text-[#23523a]"
              >
                Admin
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full px-3 py-1 transition hover:bg-[#f7f2e7] hover:text-[#23523a]"
              >
                Meu perfil
              </Link>
              <Link
                href="/dashboard/novo-agendamento"
                className="rounded-full px-3 py-1 transition hover:bg-[#f7f2e7] hover:text-[#23523a]"
              >
                Novo agendamento
              </Link>
              <Link
                href="/dashboard/agendamentos"
                className="rounded-full px-3 py-1 transition hover:bg-[#f7f2e7] hover:text-[#23523a]"
              >
                Meus agendamentos
              </Link>
            </>
          ) : role === "client" ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-full px-3 py-1 transition hover:bg-[#f7f2e7] hover:text-[#23523a]"
              >
                Meu perfil
              </Link>
              <Link
                href="/dashboard/novo-agendamento"
                className="rounded-full px-3 py-1 transition hover:bg-[#f7f2e7] hover:text-[#23523a]"
              >
                Novo agendamento
              </Link>
              <Link
                href="/dashboard/agendamentos"
                className="rounded-full px-3 py-1 transition hover:bg-[#f7f2e7] hover:text-[#23523a]"
              >
                Meus agendamentos
              </Link>
            </>
          ) : null}
        </nav>
        <div className="flex flex-col items-end gap-1 text-right">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="btn-secondary px-4 py-2"
          >
            {signingOut ? "Saindo…" : "Sair"}
          </button>
          {error ? (
            <span className="text-xs text-red-600">{error}</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
