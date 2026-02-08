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
}: Props) {
  if (!summarySnapshot) return null

  const summaryItems = [
    { label: 'Tipo', value: summarySnapshot.typeName },
    { label: 'Técnica', value: summarySnapshot.techniqueName },
    { label: 'Data', value: summarySnapshot.dateLabel },
    { label: 'Horário', value: summarySnapshot.timeLabel },
  ]

  return (
    <ClientModal
      isOpen={isOpen}
      onClose={onClose}
      title="Resumo"
      tone="info"
      contentClassName={styles.summaryModal}
      titleClassName={styles.summaryTitle}
      bodyClassName={`${modalStyles.modalBodyLeft} ${styles.summaryBody}`}
      actionsClassName={styles.summaryActions}
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
            {isProcessingPayment ? 'Processando...' : 'Pagar sinal'}
          </button>
          <button
            type="button"
            className={`${modalStyles.modalButton} ${modalStyles.modalButtonSecondary}`}
            onClick={onClose}
            disabled={isProcessingPayment}
          >
            Cancelar
          </button>
        </>
      )}
    >
      <div className={styles.summaryList}>
        {summaryItems.map((item) => (
          <div key={item.label} className={styles.summaryRow}>
            <div className={styles.summaryRowContent}>
              <span className={styles.summaryLabel}>{item.label}</span>
              <span className={styles.summaryValue}>{item.value}</span>
            </div>
            <button
              type="button"
              className={`${modalStyles.modalButton} ${modalStyles.modalButtonGhost} ${styles.summaryRowAction}`}
              onClick={onClose}
            >
              Trocar
            </button>
          </div>
        ))}
      </div>
      <input
        type="text"
        className={styles.summaryInput}
        placeholder="Observação... (opcional)"
        aria-label="Observação"
      />
      <p className={styles.summaryNotice}>
        O valor do <strong>SINAL</strong> é descontado do total.
        <br />
        O <strong>RESTANTE</strong> é pago no dia do atendimento.
      </p>
      <div className={styles.summaryTotals}>
        <div className={styles.summaryTotalRow}>
          <span className={styles.summaryTotalLabel}>Total do serviço</span>
          <span className={styles.summaryTotalValue}>{summarySnapshot.priceLabel}</span>
        </div>
        <div className={styles.summaryTotalRow}>
          <span className={styles.summaryTotalLabel}>Total sinal</span>
          <span className={styles.summaryTotalValue}>{summarySnapshot.depositLabel}</span>
        </div>
      </div>
      {modalError ? <div className={modalStyles.modalAlert}>{modalError}</div> : null}
    </ClientModal>
  )
}
