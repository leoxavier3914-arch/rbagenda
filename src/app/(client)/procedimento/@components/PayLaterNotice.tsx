import styles from '../procedimento.module.css'

type Props = {
  isOpen: boolean
  onConfirm: () => void
  onClose: () => void
}

export function PayLaterNotice({ isOpen, onConfirm, onClose }: Props) {
  if (!isOpen) return null

  return (
    <div className={styles.modal} data-open="true">
      <div className={styles.modalBackdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="pay-later-title">
        <h2 id="pay-later-title" className={styles.modalTitle}>
          Pagamento na clínica
        </h2>
        <div className={styles.modalBody}>
          Seu agendamento foi criado com sucesso. Conclua o pagamento no dia do atendimento.
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.modalButton} onClick={onConfirm}>
            Ver meus agendamentos
          </button>
          <button type="button" className={`${styles.modalButton} ${styles.modalButtonSecondary}`} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
