import styles from '../meu-perfil.module.css'

import { SaveActions } from './SaveActions'

type ProfileFormProps = {
  fullName: string
  email: string
  whatsapp: string
  birthDate: string
  password: string
  loading: boolean
  saving: boolean
  signingOut: boolean
  error: string | null
  success: string | null
  signOutError: string | null
  onFullNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onWhatsappChange: (value: string) => void
  onBirthDateChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSignOut: () => void
}

export function ProfileForm({
  fullName,
  email,
  whatsapp,
  birthDate,
  password,
  loading,
  saving,
  signingOut,
  error,
  success,
  signOutError,
  onFullNameChange,
  onEmailChange,
  onWhatsappChange,
  onBirthDateChange,
  onPasswordChange,
  onSignOut,
}: ProfileFormProps) {
  return (
    <div className={styles.fieldsColumn}>
      <div className={styles.fields}>
        <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="nome">Nome</label>
          <input
            id="nome"
            className={styles.input}
            type="text"
            placeholder="Seu nome"
            value={fullName}
            onChange={(event) => onFullNameChange(event.target.value)}
            disabled={loading || saving}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            className={styles.input}
            type="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            disabled={loading || saving}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="nascimento">Data de nascimento</label>
          <input
            id="nascimento"
            className={styles.input}
            type="date"
            value={birthDate}
            onChange={(event) => onBirthDateChange(event.target.value)}
            disabled={loading || saving}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="whatsapp">WhatsApp</label>
          <input
            id="whatsapp"
            className={styles.input}
            type="tel"
            placeholder="(11) 99999-9999"
            value={whatsapp}
            onChange={(event) => onWhatsappChange(event.target.value)}
            disabled={loading || saving}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="senha">Atualizar senha</label>
          <input
            id="senha"
            className={styles.input}
            type="password"
            placeholder="Deixe em branco para manter"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            disabled={loading || saving}
          />
        </div>
      </div>

      {loading ? <p className={styles.statusMessage}>Carregando suas informações…</p> : null}
      {error ? <div className={`${styles.alert} ${styles.error}`}>{error}</div> : null}
      {success ? <div className={`${styles.alert} ${styles.success}`}>{success}</div> : null}
      {signOutError ? <div className={`${styles.alert} ${styles.error}`}>{signOutError}</div> : null}

      <SaveActions
        saving={saving}
        loading={loading}
        signingOut={signingOut}
        onSignOut={onSignOut}
      />
    </div>
  )
}
