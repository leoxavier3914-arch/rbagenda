"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ClientPageShell, ClientSection, ClientGlassPanel } from "@/components/client/ClientPageLayout";
import { supabase } from "@/lib/db";

import { SupportContent, SupportHeader } from "./@components";
import styles from "./suporte.module.css";

export default function SuportePage() {
  const router = useRouter();
  const [heroReady, setHeroReady] = useState(false);

  useEffect(() => {
    setHeroReady(true);
  }, []);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error || !data.session) {
        router.replace("/login");
      }
    };

    void verifySession();

    return () => {
      active = false;
    };
  }, [router]);

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
