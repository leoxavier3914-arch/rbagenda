import { ClientBaseModal } from '@/components/client/ClientBaseModal'

import styles from '../agendamentos.module.css'
import type { NormalizedAppointment } from '../types'

type BlockedModalProps = {
  appointment: NormalizedAppointment | null
  onClose: () => void
}

export function BlockedModal({ appointment, onClose }: BlockedModalProps) {
  if (!appointment) return null
  return (
    <ClientBaseModal
      isOpen
      onClose={onClose}
      className={styles.modal}
      backdropClassName={styles.modalBackdrop}
      contentClassName={`${styles.modalContent} ${styles.modalWarning}`}
    >
      <div className={`${styles.iconWrap} ${styles.iconWrapWarning}`} aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d1a13b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <circle cx="12" cy="16.5" r="1" />
        </svg>
      </div>
      <h2 className={styles.modalTitle}>Alteração não permitida</h2>
      <p className={styles.modalText}>
        A alteração deste agendamento não pode ser realizada, pois faltam menos de 24h para o horário marcado.
      </p>
      <div className={styles.btnRowCenter}>
        <button type="button" className={`${styles.btn} ${styles.btnOk}`} onClick={onClose}>
          OK
        </button>
      </div>
    </ClientBaseModal>
  )
}
