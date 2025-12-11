"use client"

import styles from "../regras.module.css"

export function RulesHeader() {
  return (
    <header className={styles.heading}>
      <span className={styles.mark}>◆</span>
      <div className="space-y-2">
        <h1 className={styles.title}>
          Antes de confirmar, <span>leia com atenção:</span>
        </h1>
        <p className={styles.subtitle}>
          Cada regra fica em um card único, alinhado em coluna, no mesmo acabamento do
          procedimento.
        </p>
      </div>

      <div className={styles.ornamentalDivider} aria-hidden="true">
        <span className={styles.flourish} />
        <span className={styles.diamond} />
        <span className={styles.flourish} />
      </div>
    </header>
  )
}
