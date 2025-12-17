"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/db";

export function useCurrentUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUserId(data.session?.user?.id ?? null);
      setLoading(false);
    };

    void load();

    const { data: subscription } = supabase.auth.onAuthStateChange((_, session) => {
      if (!active) return;
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  return { userId, loading };
}
