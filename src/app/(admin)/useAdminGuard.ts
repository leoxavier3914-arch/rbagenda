"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/db";

type AdminGuardStatus = "checking" | "authorized";

type GuardResult = {
  status: AdminGuardStatus;
  role: AdminRole | "client" | null;
};

export type AdminRole = "admin" | "adminsuper" | "adminmaster";

export type GuardOptions = {
  allowedRoles?: AdminRole[];
  fallbackRedirects?: Partial<Record<AdminRole | "client" | "unauthenticated", string>>;
};

const ADMIN_ROLES: AdminRole[] = ["admin", "adminsuper", "adminmaster"];

function resolveRedirect(
  role: AdminRole | "client" | null,
  fallbackRedirects: GuardOptions["fallbackRedirects"]
) {
  if (!fallbackRedirects) return "/meu-perfil";
  if (!role) return fallbackRedirects.unauthenticated ?? "/login";
  return (
    fallbackRedirects[role] ??
    fallbackRedirects.client ??
    fallbackRedirects.unauthenticated ??
    "/login"
  );
}

export function useAdminGuard(options?: GuardOptions): GuardResult {
  const router = useRouter();
  const [status, setStatus] = useState<AdminGuardStatus>("checking");
  const [role, setRole] = useState<AdminRole | "client" | null>(null);

  const allowedRoles = options?.allowedRoles ?? ADMIN_ROLES;

  useEffect(() => {
    let active = true;

    const validate = async () => {
      const { data: sessionResponse, error } = await supabase.auth.getSession();

      if (error || !sessionResponse.session?.user?.id) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", sessionResponse.session.user.id)
        .maybeSingle();

      if (!active) return;
      const currentRole = (profile?.role ?? null) as AdminRole | "client" | null;
      setRole(currentRole);

      if (profileError || !profile || !allowedRoles.includes(profile.role as AdminRole)) {
        router.replace(resolveRedirect(currentRole, options?.fallbackRedirects));
        return;
      }

      setStatus("authorized");
    };

    validate();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (!session?.user?.id) {
        router.replace("/login");
        return;
      }

      if (event === "SIGNED_OUT") {
        router.replace("/login");
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        validate();
      }
    });

    return () => {
      active = false;
      subscription?.subscription.unsubscribe();
    };
  }, [allowedRoles, options?.fallbackRedirects, router]);

  return { status, role };
}
