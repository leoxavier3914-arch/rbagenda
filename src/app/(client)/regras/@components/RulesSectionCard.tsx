"use client"

import { type RuleSection } from "../types"
import styles from "../regras.module.css"

type RulesSectionCardProps = {
  section: RuleSection
}

export function RulesSectionCard({ section }: RulesSectionCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardInner}>
        <p className={styles.eyebrow}>{section.eyebrow}</p>
        <h2 className={styles.cardTitle}>{section.label}</h2>
        <div className={styles.inlineList}>
          {section.items.map((item) => (
            <span key={item} className={styles.inlineItem}>
              <span className={styles.inlineItemText}>{item}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
