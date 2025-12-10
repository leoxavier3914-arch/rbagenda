"use client";

import { ClientPageShell, ClientSection, ClientGlassPanel } from "@/components/client/ClientPageLayout";
import { LavaLampProvider } from "@/components/LavaLampProvider";
import styles from "./suporte.module.css";
import { SupportContent } from "./@components";

export default function SuportePage() {
  return (
    <LavaLampProvider>
      <ClientPageShell>
        <ClientSection className={styles.section}>
          <ClientGlassPanel label="SUPORTE" className={styles.card}>
            <SupportContent />
          </ClientGlassPanel>
        </ClientSection>
      </ClientPageShell>
    </LavaLampProvider>
  );
}
