"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/db";

export default function AuthHeader() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <Link href="/" className="transition hover:text-black">
            Agenda
          </Link>
          <Link href="/dashboard" className="transition hover:text-black">
            Meu perfil
          </Link>
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
