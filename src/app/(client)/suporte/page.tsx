"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ClientPageShell, ClientSection, ClientGlassPanel } from "@/components/client/ClientPageLayout";
import { useClientSessionGuard } from "@/hooks/useClientSessionGuard";

import { SupportContent, SupportHeader } from "./@components";
import styles from "./suporte.module.css";

export default function SuportePage() {
  const router = useRouter();
  const [heroReady, setHeroReady] = useState(false);
  const { isReady } = useClientSessionGuard();

  useEffect(() => {
    setHeroReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
  }, [isReady, router]);

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
