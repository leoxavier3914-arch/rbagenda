"use client";

import { ClientPageShell, ClientSection, ClientGlassPanel } from "@/components/client/ClientPageLayout";
import { useClientSessionGuard } from "@/hooks/useClientSessionGuard";
import { useClientPageReady } from "@/hooks/useClientPageReady";

import { SupportContent, SupportHeader } from "./@components";
import styles from "./suporte.module.css";

export default function SuportePage() {
  const heroReady = useClientPageReady();
  const { session, isReady: isSessionReady } = useClientSessionGuard();

  return (
    <ClientPageShell heroReady={heroReady} forceMotion viewport="app">
      <ClientSection className={styles.section}>
        <SupportHeader />

        <ClientGlassPanel label="SUPORTE" className={styles.card}>
          <SupportContent session={session} isSessionReady={isSessionReady} />
        </ClientGlassPanel>
      </ClientSection>
    </ClientPageShell>
  );
}
