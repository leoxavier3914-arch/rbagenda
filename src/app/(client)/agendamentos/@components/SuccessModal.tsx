import styles from '../agendamentos.module.css'
import type { SuccessDialogState } from '../types'

type SuccessModalProps = {
  dialog: SuccessDialogState
  onClose: () => void
}

export function SuccessModal({ dialog, onClose }: SuccessModalProps) {
  if (!dialog) return null
  return (
    <div className={styles.modal} aria-hidden="false">
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={`${styles.modalContent} ${styles.modalSuccess}`} role="dialog" aria-modal="true">
        <div className={`${styles.iconWrap} ${styles.iconWrapSuccess}`} aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1f8a70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className={styles.modalTitle}>{dialog.title}</h2>
        <p className={styles.modalText}>{dialog.message}</p>
        <div className={styles.btnRowCenter}>
          <button type="button" className={`${styles.btn} ${styles.btnOk}`} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
