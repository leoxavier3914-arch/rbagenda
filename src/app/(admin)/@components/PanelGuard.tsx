"use client";

import type { ReactNode } from "react";

import { useAdminGuard, type AdminRole } from "../useAdminGuard";

type PanelGuardProps = {
  allowedRoles: AdminRole[];
  fallbackRedirects: Partial<Record<AdminRole | "client" | "unauthenticated", string>>;
  children: (role: AdminRole) => ReactNode;
};

export function PanelGuard({ allowedRoles, fallbackRedirects, children }: PanelGuardProps) {
  const { status, role } = useAdminGuard({ allowedRoles, fallbackRedirects });

  if (status !== "authorized" || !role || !allowedRoles.includes(role)) {
    return null;
  }

  return <>{children(role)}</>;
}
