"use client"

import { RulesSectionCard } from "./RulesSectionCard"
import { RulesSectionDivider } from "./RulesSectionDivider"
import { type RuleSection } from "../types"

import styles from "../rules.module.css"

type RulesSectionListProps = {
  sections: RuleSection[]
}

export function RulesSectionList({ sections }: RulesSectionListProps) {
  return (
    <div className={styles.cardList}>
      {sections.map((section, index) => (
        <div key={section.label}>
          <RulesSectionCard section={section} />
          {index < sections.length - 1 && <RulesSectionDivider />}
        </div>
      ))}
    </div>
  )
}
