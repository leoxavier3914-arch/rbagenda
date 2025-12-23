import { ClientModal } from '@/components/client/ClientModal'
import modalStyles from '@/components/client/client-modal.module.css'

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
    <ClientModal
      isOpen={isOpen}
      onClose={onClose}
      title="Resumo do agendamento"
      tone="info"
      contentClassName={styles.summaryModal}
      disableBackdropClose={isProcessingPayment}
      contentProps={{ 'aria-labelledby': 'appointment-summary-title' }}
      actions={(
        <>
          <button
            type="button"
            className={`${modalStyles.modalButton} ${modalStyles.modalButtonSuccess}`}
            onClick={onPayDeposit}
            disabled={isProcessingPayment || !depositAvailable}
          >
            {isProcessingPayment ? 'Processando…' : 'Pagar sinal'}
          </button>
          <button
            type="button"
            className={`${modalStyles.modalButton} ${modalStyles.modalButtonSecondary}`}
            onClick={onPayLater}
            disabled={isProcessingPayment}
          >
            Pagar depois
          </button>
        </>
      )}
    >
      <div className={styles.summaryList}>
        <div className={styles.summaryLine}>
          <span>Tipo</span>
          <strong>{summarySnapshot.typeName}</strong>
        </div>
        <div className={styles.summaryLine}>
          <span>Técnica</span>
          <strong>{summarySnapshot.techniqueName}</strong>
        </div>
        <div className={styles.summaryLine}>
          <span>Horário</span>
          <strong>
            {summarySnapshot.dateLabel} às {summarySnapshot.timeLabel}
          </strong>
        </div>
        <div className={styles.summaryLine}>
          <span>Duração</span>
          <strong>{summarySnapshot.durationLabel}</strong>
        </div>
        <div className={styles.summaryLine}>
          <span>Valor</span>
          <strong>{summarySnapshot.priceLabel}</strong>
        </div>
        {summarySnapshot.depositCents > 0 ? (
          <div className={styles.summaryLine}>
            <span>Sinal</span>
            <strong>{summarySnapshot.depositLabel}</strong>
          </div>
        ) : null}
      </div>
      {modalError ? <div className={modalStyles.modalAlert}>{modalError}</div> : null}
    </ClientModal>
  )
}
