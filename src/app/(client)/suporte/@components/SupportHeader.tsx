import { ClientPageHeader } from "@/components/client/ClientPageLayout";

import styles from "../suporte.module.css";

export function SupportHeader() {
  return (
    <ClientPageHeader
      className={styles.header}
      title="Como posso te ajudar?"
      subtitle="Esta página de suporte ainda está em construção. Em breve você verá aqui os canais oficiais de atendimento."
      subtitleClassName={styles.subtitle}
    />
  );
}
