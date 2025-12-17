"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AdminThemeId = "light" | "dark" | "romeike" | "white-label";

type AdminThemePreset = {
  id: AdminThemeId;
  name: string;
  description: string;
};

type AdminThemeContextValue = {
  theme: AdminThemeId;
  setTheme: (theme: AdminThemeId) => void;
  presets: AdminThemePreset[];
};

const STORAGE_KEY = "rbagenda_admin_theme";

const THEME_PRESETS: AdminThemePreset[] = [
  { id: "light", name: "Light", description: "Visual claro e minimalista." },
  { id: "dark", name: "Dark", description: "Interface escura com alto contraste." },
  { id: "romeike", name: "Romeike Beauty", description: "Toques magenta inspirados em beauty." },
  { id: "white-label", name: "White Label", description: "Base neutra pronta para marca branca." },
];

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

function isValidTheme(value: string | null): value is AdminThemeId {
  return Boolean(value && THEME_PRESETS.some((preset) => preset.id === value));
}

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AdminThemeId>("dark");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isValidTheme(stored)) {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("admin-theme");
    document.body.setAttribute("data-admin-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);

    return () => {
      document.body.classList.remove("admin-theme");
      document.body.removeAttribute("data-admin-theme");
    };
  }, [theme]);

  const value = useMemo(
    () => ({ theme, setTheme, presets: THEME_PRESETS }),
    [theme]
  );

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error("useAdminTheme must be used within AdminThemeProvider");
  }
  return context;
}
