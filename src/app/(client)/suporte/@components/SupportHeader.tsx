import styles from "../suporte.module.css";

export function SupportHeader() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Como posso te ajudar?</h1>
      <p className={styles.subtitle}>
        Esta página de suporte ainda está em construção. Em breve você verá aqui os canais oficiais de atendimento.
      </p>
    </header>
  );
}
