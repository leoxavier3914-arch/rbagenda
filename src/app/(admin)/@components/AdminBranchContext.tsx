"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/lib/db";

const STORAGE_KEY = "rbagenda_admin_active_branch_id";

type BranchOption = {
  id: string;
  name: string | null;
};

type AdminBranchContextValue = {
  branches: BranchOption[];
  activeBranchId: string | null;
  setActiveBranchId: (value: string | null) => void;
  loading: boolean;
  isMaster: boolean;
};

const AdminBranchContext = createContext<AdminBranchContextValue | null>(null);

export function AdminBranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      setActiveBranchIdState(stored);
    }
  }, []);

  const setActiveBranchId = useCallback((value: string | null) => {
    setActiveBranchIdState(value);
    if (typeof window !== "undefined") {
      if (value) {
        window.localStorage.setItem(STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadBranches = async () => {
      setLoading(true);
      const { data: sessionResult } = await supabase.auth.getSession();
      const userId = sessionResult?.session?.user?.id;

      if (!userId) {
        setBranches([]);
        setActiveBranchIdState(null);
        setLoading(false);
        setIsMaster(false);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      const role = profile?.role ?? null;
      const master = role === "adminmaster";
      setIsMaster(master);

      let resolvedBranches: BranchOption[] = [];

      if (master) {
        const { data } = await supabase.from("branches").select("id, name").order("name", { ascending: true });
        resolvedBranches = data ?? [];
      } else if (role === "adminsuper") {
        const { data } = await supabase
          .from("branches")
          .select("id, name")
          .eq("owner_id", userId)
          .order("name", { ascending: true });
        resolvedBranches = data ?? [];
      } else {
        const { data } = await supabase
          .from("branch_admins")
          .select("branch_id, branches(name)")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        resolvedBranches =
          data?.map((assignment) => ({ id: assignment.branch_id, name: assignment.branches?.name ?? null })) ?? [];
      }

      if (!active) return;

      setBranches(resolvedBranches);

      setActiveBranchIdState((current) => {
        let nextValue = current;

        if (current && resolvedBranches.some((branch) => branch.id === current)) {
          nextValue = current;
        } else if (resolvedBranches.length === 1) {
          nextValue = resolvedBranches[0].id;
        } else {
          nextValue = null;
        }

        if (typeof window !== "undefined") {
          if (nextValue) {
            window.localStorage.setItem(STORAGE_KEY, nextValue);
          } else {
            window.localStorage.removeItem(STORAGE_KEY);
          }
        }

        return nextValue;
      });

      setLoading(false);
    };

    void loadBranches();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ branches, activeBranchId, setActiveBranchId, loading, isMaster }),
    [activeBranchId, branches, isMaster, loading, setActiveBranchId]
  );

  return <AdminBranchContext.Provider value={value}>{children}</AdminBranchContext.Provider>;
}

export function useAdminBranch() {
  const context = useContext(AdminBranchContext);
  if (!context) {
    throw new Error("useAdminBranch must be used within AdminBranchProvider");
  }
  return context;
}
