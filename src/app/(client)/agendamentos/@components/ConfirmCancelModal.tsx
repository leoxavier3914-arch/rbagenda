import styles from '../agendamentos.module.css'
import type { CancelDialogState } from '../types'
import { BaseModal } from './BaseModal'

type ConfirmCancelModalProps = {
  dialog: CancelDialogState
  onClose: () => void
  onConfirm: (dialog: CancelDialogState) => void
  isProcessing: boolean
  errorMessage: string | null
}

export function ConfirmCancelModal({ dialog, onClose, onConfirm, isProcessing, errorMessage }: ConfirmCancelModalProps) {
  if (!dialog) return null

  const isPenalty = dialog.variant === 'penalty'
  const title = 'Cancelar agendamento?'
  const message = isPenalty
    ? 'Você pode cancelar este agendamento, mas o valor do sinal será perdido e não será reembolsado. Deseja continuar?'
    : 'Seu agendamento está dentro das regras de cancelamento. Deseja realmente cancelar seu horário?'

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      contentClassName={styles.modalWarning}
      disableBackdropClose={isProcessing}
    >
      <div className={`${styles.iconWrap} ${isPenalty ? styles.iconWrapWarning : ''}`} aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d1a13b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <circle cx="12" cy="16.5" r="1" />
        </svg>
      </div>
      <h2 className={styles.modalTitle}>{title}</h2>
      <p className={styles.modalText}>
        {message}
      </p>
      {errorMessage ? <div className={styles.modalError}>{errorMessage}</div> : null}
      <div className={styles.btnRow}>
        <button type="button" className={`${styles.btn} ${styles.btnYes}`} disabled={isProcessing} onClick={() => onConfirm(dialog)}>
          {isProcessing ? 'Cancelando…' : isPenalty ? 'Sim, cancela' : 'Sim, cancelar'}
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnNo}`} disabled={isProcessing} onClick={onClose}>
          Não
        </button>
      </div>
    </BaseModal>
  )
}
