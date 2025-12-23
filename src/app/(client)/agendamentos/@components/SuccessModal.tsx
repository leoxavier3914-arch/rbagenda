import { ClientModal } from '@/components/client/ClientModal'
import modalStyles from '@/components/client/client-modal.module.css'
import type { SuccessDialogState } from '../types'

type SuccessModalProps = {
  dialog: SuccessDialogState
  onClose: () => void
}

export function SuccessModal({ dialog, onClose }: SuccessModalProps) {
  if (!dialog) return null
  return (
    <ClientModal
      isOpen
      onClose={onClose}
      title={dialog.title}
      tone="success"
      icon={(
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1f8a70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
      actions={(
        <button type="button" className={`${modalStyles.modalButton} ${modalStyles.modalButtonSuccess}`} onClick={onClose}>
          OK
        </button>
      )}
    >
      <p className={modalStyles.modalText}>{dialog.message}</p>
    </ClientModal>
  )
}
