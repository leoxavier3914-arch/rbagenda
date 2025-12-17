"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/lib/db";

const STORAGE_KEY = "rbagenda_admin_active_branch_id";
const STORAGE_SCOPE_KEY = "rbagenda_admin_active_branch_scope";

type BranchScope = "none" | "branch" | "no_branch";

type BranchOption = {
  id: string;
  name: string | null;
};

type AdminBranchContextValue = {
  branches: BranchOption[];
  activeBranchId: string | null;
  setActiveBranchId: (value: string | null) => void;
  branchScope: BranchScope;
  setBranchScope: (scope: BranchScope) => void;
  loading: boolean;
  isMaster: boolean;
};

const AdminBranchContext = createContext<AdminBranchContextValue | null>(null);

export function AdminBranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
  const [branchScope, setBranchScopeState] = useState<BranchScope>("none");
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const storedScope = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_SCOPE_KEY) : null;

    if (stored) {
      setActiveBranchIdState(stored);
      setBranchScopeState(storedScope === "no_branch" ? "no_branch" : "branch");
    } else {
      setBranchScopeState(storedScope === "no_branch" ? "no_branch" : "none");
    }
  }, []);

  const setBranchScope = useCallback((scope: BranchScope) => {
    setBranchScopeState(scope);
  }, []);

  const setActiveBranchId = useCallback((value: string | null) => {
    setActiveBranchIdState(value);
    setBranchScopeState((current) => {
      if (current === "no_branch") {
        return value ? "branch" : current;
      }
      return value ? "branch" : "none";
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (activeBranchId) {
      window.localStorage.setItem(STORAGE_KEY, activeBranchId);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    window.localStorage.setItem(STORAGE_SCOPE_KEY, branchScope);
  }, [activeBranchId, branchScope]);

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

        type BranchAssignment = { branch_id: string; branches?: { name?: string | null } | null };

        resolvedBranches =
          (data as BranchAssignment[] | null)?.map((assignment) => ({
            id: assignment.branch_id,
            name: assignment.branches?.name ?? null,
          })) ?? [];
      }

      if (!active) return;

      setBranches(resolvedBranches);

      const nextActiveBranchId = (() => {
        if (branchScope === "no_branch") {
          return null;
        }

        if (activeBranchId && resolvedBranches.some((branch) => branch.id === activeBranchId)) {
          return activeBranchId;
        }

        if (resolvedBranches.length === 1) {
          return resolvedBranches[0].id;
        }

        return null;
      })();

      setActiveBranchIdState(nextActiveBranchId);

      setBranchScopeState((currentScope) => {
        if (currentScope === "no_branch") {
          return master ? "no_branch" : "none";
        }
        return nextActiveBranchId ? "branch" : resolvedBranches.length === 1 ? "branch" : "none";
      });

      setLoading(false);
    };

    void loadBranches();

    return () => {
      active = false;
    };
  }, [activeBranchId, branchScope]);

  const value = useMemo(
    () => ({ branches, activeBranchId, setActiveBranchId, branchScope, setBranchScope, loading, isMaster }),
    [activeBranchId, branchScope, branches, isMaster, loading, setActiveBranchId, setBranchScope]
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
