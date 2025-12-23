import { ClientModal } from '@/components/client/ClientModal'
import modalStyles from '@/components/client/client-modal.module.css'
import type { NormalizedAppointment } from '../types'

type BlockedModalProps = {
  appointment: NormalizedAppointment | null
  onClose: () => void
}

export function BlockedModal({ appointment, onClose }: BlockedModalProps) {
  if (!appointment) return null
  return (
    <ClientModal
      isOpen
      onClose={onClose}
      title="Alteração não permitida"
      tone="warning"
      icon={(
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d1a13b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <circle cx="12" cy="16.5" r="1" />
        </svg>
      )}
      actions={(
        <button type="button" className={`${modalStyles.modalButton} ${modalStyles.modalButtonSuccess}`} onClick={onClose}>
          OK
        </button>
      )}
    >
      <p className={modalStyles.modalText}>
        A alteração deste agendamento não pode ser realizada, pois faltam menos de 24h para o horário marcado.
      </p>
    </ClientModal>
  )
}
