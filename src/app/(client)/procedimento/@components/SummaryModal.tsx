import { ClientBaseModal } from '@/components/client/ClientBaseModal'

import styles from '../procedimento.module.css'

import type { SummarySnapshot } from '../types'

type Props = {
  summarySnapshot: SummarySnapshot | null
  isOpen: boolean
  modalError: string | null
  isProcessingPayment: boolean
  depositAvailable: boolean
  onClose: () => void
  onPayDeposit: () => void
  onPayLater: () => void
}

export function SummaryModal({
  summarySnapshot,
  isOpen,
  modalError,
  isProcessingPayment,
  depositAvailable,
  onClose,
  onPayDeposit,
  onPayLater,
}: Props) {
  if (!summarySnapshot) return null

  return (
    <ClientBaseModal
      isOpen={isOpen}
      onClose={onClose}
      className={styles.modal}
      backdropClassName={styles.modalBackdrop}
      contentClassName={styles.modalContent}
      contentProps={{ 'aria-labelledby': 'appointment-summary-title' }}
      data-open={isOpen ? 'true' : 'false'}
    >
      <h2 id="appointment-summary-title" className={styles.modalTitle}>
        Resumo do agendamento
      </h2>
      <div className={styles.modalBody}>
        <div className={styles.modalLine}>
          <span>Tipo</span>
          <strong>{summarySnapshot.typeName}</strong>
        </div>
        <div className={styles.modalLine}>
          <span>Técnica</span>
          <strong>{summarySnapshot.techniqueName}</strong>
        </div>
        <div className={styles.modalLine}>
          <span>Horário</span>
          <strong>
            {summarySnapshot.dateLabel} às {summarySnapshot.timeLabel}
          </strong>
        </div>
        <div className={styles.modalLine}>
          <span>Duração</span>
          <strong>{summarySnapshot.durationLabel}</strong>
        </div>
        <div className={styles.modalLine}>
          <span>Valor</span>
          <strong>{summarySnapshot.priceLabel}</strong>
        </div>
        {summarySnapshot.depositCents > 0 ? (
          <div className={styles.modalLine}>
            <span>Sinal</span>
            <strong>{summarySnapshot.depositLabel}</strong>
          </div>
        ) : null}
      </div>
      {modalError ? <div className={`${styles.status} ${styles.statusError}`}>{modalError}</div> : null}
      <div className={styles.modalActions}>
        <button
          type="button"
          className={styles.modalButton}
          onClick={onPayDeposit}
          disabled={isProcessingPayment || !depositAvailable}
        >
          {isProcessingPayment ? 'Processando…' : 'Pagar sinal'}
        </button>
        <button
          type="button"
          className={`${styles.modalButton} ${styles.modalButtonSecondary}`}
          onClick={onPayLater}
          disabled={isProcessingPayment}
        >
          Pagar depois
        </button>
      </div>
    </ClientBaseModal>
  )
}
