"use client";

import { ClientPageShell, ClientSection, ClientGlassPanel } from "@/components/client/ClientPageLayout";
import { useClientSessionGuard } from "@/hooks/useClientSessionGuard";
import { useClientPageReady } from "@/hooks/useClientPageReady";

import { SupportContent, SupportHeader } from "./@components";
import styles from "./suporte.module.css";

export default function SuportePage() {
  const heroReady = useClientPageReady();
  useClientSessionGuard();

  return (
    <ClientPageShell heroReady={heroReady} forceMotion>
      <ClientSection>
        <SupportHeader />

        <ClientGlassPanel label="SUPORTE" className={styles.card}>
          <SupportContent />
        </ClientGlassPanel>
      </ClientSection>
    </ClientPageShell>
  );
}
