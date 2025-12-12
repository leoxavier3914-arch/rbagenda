"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/db";

type AdminGuardStatus = "checking" | "authorized";

type GuardResult = {
  status: AdminGuardStatus;
};

const ADMIN_ROLES = ["admin", "adminsuper", "adminmaster"];

export function useAdminGuard(): GuardResult {
  const router = useRouter();
  const [status, setStatus] = useState<AdminGuardStatus>("checking");

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

      if (profileError || !profile || !ADMIN_ROLES.includes(profile.role)) {
        router.replace("/meu-perfil");
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
  }, [router]);

  return { status };
}
