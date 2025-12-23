import { ClientModal } from '@/components/client/ClientModal'
import modalStyles from '@/components/client/client-modal.module.css'

import styles from '../procedimento.module.css'

type Props = {
  isOpen: boolean
  isSubmitting: boolean
  errorMessage: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function PayLaterNotice({ isOpen, isSubmitting, errorMessage, onConfirm, onCancel }: Props) {
  if (!isOpen) return null

  return (
    <ClientModal
      isOpen={isOpen}
      onClose={onCancel}
      title="Agendamento pendente"
      tone="warning"
      contentClassName={styles.summaryModal}
      disableBackdropClose={isSubmitting}
      actions={(
        <>
          <button
            type="button"
            className={`${modalStyles.modalButton} ${modalStyles.modalButtonSecondary}`}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={modalStyles.modalButton}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Criando…' : 'Aceito'}
          </button>
        </>
      )}
    >
      <p className={modalStyles.modalText}>
        O sinal pode ser pago em até 2h, caso contrário o agendamento é cancelado e o horário disponibilizado.
      </p>
      {errorMessage ? <div className={modalStyles.modalAlert}>{errorMessage}</div> : null}
    </ClientModal>
  )
}
