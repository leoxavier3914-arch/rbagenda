import styles from "../suporte.module.css";

export function SupportContent() {
  return (
    <div className={styles.content}>
      <h1 className={styles.title}>Como posso te ajudar?</h1>

      <p className={styles.subtitle}>
        Esta página de suporte ainda está em construção. Em breve você verá aqui os canais oficiais de atendimento.
      </p>

      <ul className={styles.list}>
        <li className={styles.item}>
          <span className={styles.itemLabel}>WhatsApp</span>
          <span className={styles.itemValue}>Em breve</span>
        </li>
        <li className={styles.item}>
          <span className={styles.itemLabel}>E-mail</span>
          <span className={styles.itemValue}>Em breve</span>
        </li>
        <li className={styles.item}>
          <span className={styles.itemLabel}>Horário</span>
          <span className={styles.itemValue}>Em breve</span>
        </li>
      </ul>
    </div>
  );
}
