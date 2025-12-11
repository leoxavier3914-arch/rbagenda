"use client";

import { useEffect } from "react";

import { ClientPageShell, ClientSection, ClientGlassPanel } from "@/components/client/ClientPageLayout";
import { useClientSessionGuard } from "@/hooks/useClientSessionGuard";
import { useClientPageReady } from "@/hooks/useClientPageReady";

import { SupportContent, SupportHeader } from "./@components";
import styles from "./suporte.module.css";

export default function SuportePage() {
  const heroReady = useClientPageReady();
  useClientSessionGuard();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.add("force-motion");
    return () => {
      document.documentElement.classList.remove("force-motion");
    };
  }, []);

  return (
    <ClientPageShell heroReady={heroReady}>
      <ClientSection>
        <SupportHeader />

        <ClientGlassPanel label="SUPORTE" className={styles.card}>
          <SupportContent />
        </ClientGlassPanel>
      </ClientSection>
    </ClientPageShell>
  );
}
