"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AdminTheme = "light" | "dark" | "romeike" | "white-label";

type ThemeContextValue = {
  theme: AdminTheme;
  setTheme: (next: AdminTheme) => void;
  themes: { id: AdminTheme; name: string; description: string }[];
};

const AdminThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "rbagenda-admin-theme";
const DEFAULT_THEME: AdminTheme = "light";

const themes: ThemeContextValue["themes"] = [
  { id: "light", name: "Light", description: "Visual claro e limpo para escritórios e uso diurno." },
  { id: "dark", name: "Dark", description: "Tons escuros com alto contraste para longas jornadas." },
  { id: "romeike", name: "Romeike Beauty", description: "Palette moderna com destaque em azul petróleo." },
  { id: "white-label", name: "White Label", description: "Base neutra para marcas com identidade própria." },
];

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AdminTheme>(DEFAULT_THEME);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as AdminTheme | null;
    if (stored && themes.some((item) => item.id === stored)) {
      setThemeState(stored);
    }
  }, []);

  const setTheme = (next: AdminTheme) => {
    setThemeState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme, themes }), [theme]);

  return (
    <AdminThemeContext.Provider value={value}>
      <div className="admin-theme" data-theme={theme}>
        {children}
      </div>
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error("useAdminTheme deve ser usado dentro de AdminThemeProvider");
  }
  return context;
}
