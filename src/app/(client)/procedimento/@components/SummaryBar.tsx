import type { RefObject } from 'react'

import styles from '../procedimento.module.css'

import type { SummarySnapshot } from '../types'

type Props = {
  summaryData: SummarySnapshot | null
  hasSummary: boolean
  continueButtonDisabled: boolean
  continueButtonLabel: string
  onContinue: () => void
  summaryRef: RefObject<HTMLDivElement>
}

export function SummaryBar({
  summaryData,
  hasSummary,
  continueButtonDisabled,
  continueButtonLabel,
  onContinue,
  summaryRef,
}: Props) {
  if (!hasSummary) return null

  return (
    <div className={styles.summaryBar} data-visible={hasSummary ? 'true' : 'false'} ref={summaryRef}>
      <div className={styles.summaryDetails}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Tipo</span>
          <span className={styles.summaryValue}>{summaryData?.typeName}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Técnica</span>
          <span className={styles.summaryValue}>{summaryData?.techniqueName}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Valor</span>
          <span className={styles.summaryValue}>{summaryData?.priceLabel}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Duração</span>
          <span className={styles.summaryValue}>{summaryData?.durationLabel}</span>
        </div>
        <div className={`${styles.summaryItem} ${styles.summaryItemFull}`}>
          <span className={styles.summaryLabel}>Horário</span>
          <span className={styles.summaryValue}>
            {summaryData?.dateLabel} às {summaryData?.timeLabel}
          </span>
        </div>
      </div>
      <button type="button" className={styles.summaryAction} onClick={onContinue} disabled={continueButtonDisabled}>
        {continueButtonLabel}
      </button>
    </div>
  )
}
