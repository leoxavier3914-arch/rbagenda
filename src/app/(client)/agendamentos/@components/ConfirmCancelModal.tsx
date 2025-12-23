import { ClientModal } from '@/components/client/ClientModal'
import modalStyles from '@/components/client/client-modal.module.css'
import type { CancelDialogState } from '../types'

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
    <ClientModal
      isOpen
      onClose={onClose}
      title={title}
      tone="warning"
      icon={(
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d1a13b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <circle cx="12" cy="16.5" r="1" />
        </svg>
      )}
      disableBackdropClose={isProcessing}
      actions={(
        <>
          <button
            type="button"
            className={`${modalStyles.modalButton} ${modalStyles.modalButtonDanger}`}
            disabled={isProcessing}
            onClick={() => onConfirm(dialog)}
          >
            {isProcessing ? 'Cancelando…' : isPenalty ? 'Sim, cancela' : 'Sim, cancelar'}
          </button>
          <button
            type="button"
            className={`${modalStyles.modalButton} ${modalStyles.modalButtonSecondary}`}
            disabled={isProcessing}
            onClick={onClose}
          >
            Não
          </button>
        </>
      )}
    >
      <p className={modalStyles.modalText}>
        {message}
      </p>
      {errorMessage ? <div className={modalStyles.modalAlert}>{errorMessage}</div> : null}
    </ClientModal>
  )
}
