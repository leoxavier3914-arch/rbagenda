import { useState } from 'react'

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
  const [activeSection, setActiveSection] = useState<
    'dados' | 'seguranca' | 'temas' | 'notificacoes'
  >('dados')
  const [isEmailEditing, setIsEmailEditing] = useState(false)
  const [isPasswordEditing, setIsPasswordEditing] = useState(false)

  const handleSectionChange = (
    section: 'dados' | 'seguranca' | 'temas' | 'notificacoes',
  ) => {
    setActiveSection(section)
    setIsEmailEditing(false)
    setIsPasswordEditing(false)
  }

  return (
    <div className={styles.fieldsColumn}>
      <div className={styles.sectionTabs} role="tablist" aria-label="Seções do perfil">
        <button
          type="button"
          className={styles.sectionBadge}
          data-active={activeSection === 'dados'}
          onClick={() => handleSectionChange('dados')}
        >
          Dados pessoais
        </button>
        <button
          type="button"
          className={styles.sectionBadge}
          data-active={activeSection === 'seguranca'}
          onClick={() => handleSectionChange('seguranca')}
        >
          Segurança
        </button>
        <button
          type="button"
          className={styles.sectionBadge}
          data-active={activeSection === 'temas'}
          onClick={() => handleSectionChange('temas')}
        >
          Temas
        </button>
        <button
          type="button"
          className={styles.sectionBadge}
          data-active={activeSection === 'notificacoes'}
          onClick={() => handleSectionChange('notificacoes')}
        >
          Notificações
        </button>
      </div>

      {activeSection === 'dados' ? (
        <div className={styles.sectionStack}>
          <div className={styles.sectionCard}>
            <p className={styles.sectionCardLabel}>Identificação</p>
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
            </div>
          </div>
          <div className={styles.sectionCard}>
            <p className={styles.sectionCardLabel}>Contato</p>
            <div className={styles.fields}>
              <div className={styles.field}>
                <div className={styles.fieldHeader}>
                  {isEmailEditing ? (
                    <label htmlFor="email">E-mail</label>
                  ) : (
                    <span className={styles.fieldLabel}>E-mail</span>
                  )}
                  <button
                    type="button"
                    className={styles.inlineAction}
                    onClick={() => setIsEmailEditing((prev) => !prev)}
                    disabled={loading || saving}
                  >
                    {isEmailEditing ? 'Cancelar' : 'Alterar'}
                  </button>
                </div>
                {isEmailEditing ? (
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
                ) : (
                  <p className={styles.readonlyValue}>{email || 'Não informado'}</p>
                )}
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
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === 'seguranca' ? (
        <div className={styles.sectionStack}>
          <div className={styles.sectionCard}>
            <p className={styles.sectionCardLabel}>Segurança</p>
            <div className={styles.fields}>
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <div className={styles.fieldHeader}>
                  {isPasswordEditing ? (
                    <label htmlFor="senha">Senha</label>
                  ) : (
                    <span className={styles.fieldLabel}>Senha</span>
                  )}
                  <button
                    type="button"
                    className={styles.inlineAction}
                    onClick={() => setIsPasswordEditing((prev) => !prev)}
                    disabled={loading || saving}
                  >
                    {isPasswordEditing ? 'Cancelar' : 'Alterar'}
                  </button>
                </div>
                {isPasswordEditing ? (
                  <input
                    id="senha"
                    className={styles.input}
                    type="password"
                    placeholder="Digite a nova senha"
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    disabled={loading || saving}
                  />
                ) : (
                  <p className={styles.readonlyValue}>
                    Para atualizar sua senha, clique em alterar.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === 'temas' ? (
        <div className={styles.sectionStack}>
          <div className={styles.sectionCard}>
            <div className={styles.emptyState}>
              <p>Em breve vamos liberar temas personalizados por aqui.</p>
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === 'notificacoes' ? (
        <div className={styles.sectionStack}>
          <div className={styles.sectionCard}>
            <div className={styles.emptyState}>
              <p>Em breve você poderá gerenciar notificações do app.</p>
            </div>
          </div>
        </div>
      ) : null}

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
