import styles from '../meu-perfil.module.css'

type SaveActionsProps = {
  saving: boolean
  loading: boolean
  signingOut: boolean
  onSignOut: () => void
}

export function SaveActions({
  saving,
  loading,
  signingOut,
  onSignOut,
}: SaveActionsProps) {
  return (
    <div className={styles.actions}>
      <button
        className={`${styles.btn} ${styles.primary}`}
        type="submit"
        disabled={saving || loading}
      >
        {saving ? 'Salvando…' : 'Salvar alterações'}
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.secondary}`}
        onClick={onSignOut}
        disabled={signingOut}
      >
        {signingOut ? 'Saindo…' : 'Encerrar sessão'}
      </button>
    </div>
  )
}
