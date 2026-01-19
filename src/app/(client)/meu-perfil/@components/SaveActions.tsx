import styles from '../meu-perfil.module.css'

type SaveActionsProps = {
  saving: boolean
  loading: boolean
  isDirty: boolean
}

export function SaveActions({ saving, loading, isDirty }: SaveActionsProps) {
  return (
    <div className={styles.actions}>
      <button
        className={`${styles.btn} ${styles.primary}`}
        type="submit"
        disabled={saving || loading || !isDirty}
      >
        {saving ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </div>
  )
}
