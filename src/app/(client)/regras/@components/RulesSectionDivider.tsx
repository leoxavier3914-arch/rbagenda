"use client"

import styles from "../rules.module.css"

export function RulesSectionDivider() {
  return (
    <div className={styles.sectionDivider} aria-hidden="true">
      <span className={styles.sectionLine} />
    </div>
  )
}
