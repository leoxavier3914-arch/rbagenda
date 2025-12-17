"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/db";
import { PanelGuard } from "@/app/(admin)/@components/PanelGuard";

import styles from "../../../adminPanel.module.css";

type RoleOption = "admin" | "adminsuper" | "adminmaster";

type User = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: RoleOption;
};

function MasterSupersContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [selection, setSelection] = useState<Record<string, RoleOption>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("role", ["admin", "adminsuper", "adminmaster"])
        .order("created_at", { ascending: false });

      if (!active) return;

      if (queryError) {
        setError("Não foi possível carregar os usuários administrativos.");
        setLoading(false);
        return;
      }

      const normalized = (data ?? []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name ?? null,
        email: profile.email ?? null,
        role: (profile.role ?? "admin") as RoleOption,
      }));

      setUsers(normalized);
      setSelection({});
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const handleUpdateRole = async (userId: string) => {
    const nextRole = selection[userId];
    if (!nextRole) {
      setFeedback("Selecione um cargo para alterar.");
      return;
    }

    const { error: rpcError } = await supabase.rpc("set_profile_role", {
      target_user_id: userId,
      new_role: nextRole,
    });

    if (rpcError) {
      setFeedback("Não foi possível atualizar o cargo.");
      return;
    }

    setUsers((current) => current.map((user) => (user.id === userId ? { ...user, role: nextRole } : user)));
    setFeedback("Cargo atualizado.");
  };

  return (
    <div className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroIntro}>
          <span className={styles.badge}>Admin master</span>
          <h2 className={styles.heroTitle}>Gerenciar supers</h2>
          <p className={styles.heroSubtitle}>Promova ou rebaixe cargos usando o RPC dedicado.</p>
        </div>
      </section>

      {error ? <div className={styles.mutedPanel}>{error}</div> : null}

      <div className={styles.panelCard}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Usuários administrativos</h3>
          <p className={styles.panelSubtitle}>{users.length} contas</p>
        </div>

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <ul className={styles.simpleList}>
            {users.map((user) => (
              <li key={user.id} className={styles.simpleListItem}>
                <div className={styles.simpleListContent}>
                  <p className={styles.simpleListTitle}>{user.full_name ?? "Usuário"}</p>
                  <p className={styles.simpleListSubtitle}>{user.email ?? "Sem e-mail"}</p>
                  <p className={styles.simpleListMeta}>Cargo atual: {user.role}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <select
                    className={styles.input}
                    value={selection[user.id] ?? user.role}
                    onChange={(event) => setSelection((state) => ({ ...state, [user.id]: event.target.value as RoleOption }))}
                  >
                    <option value="admin">Admin</option>
                    <option value="adminsuper">Admin super</option>
                    <option value="adminmaster">Admin master</option>
                  </select>
                  <button className={styles.primaryButton} type="button" onClick={() => void handleUpdateRole(user.id)}>
                    Atualizar cargo
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {feedback ? <div className={`${styles.feedback} ${styles.feedbackSuccess}`}>{feedback}</div> : null}
    </div>
  );
}

export default function MasterSupersPanel() {
  return (
    <PanelGuard
      allowedRoles={["adminmaster"]}
      fallbackRedirects={{
        admin: "/admin",
        adminsuper: "/admin/adminsuper",
        client: "/login",
        unauthenticated: "/login",
      }}
    >
      {() => <MasterSupersContent />}
    </PanelGuard>
  );
}
