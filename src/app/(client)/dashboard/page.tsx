'use client'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/db'

type Profile = {
  full_name: string | null
  whatsapp: string | null
  email: string | null
  role?: 'admin' | 'client'
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function loadProfile() {
      setLoading(true)
      setError(null)

      const { data: sess, error: sessionError } = await supabase.auth.getSession()
      if (!active) return

      if (sessionError) {
        setError('Não foi possível carregar seus dados. Tente novamente.')
        setLoading(false)
        return
      }

      const currentSession = sess.session

      if (!currentSession) {
        router.replace('/login')
        return
      }

      setSession(currentSession)

      const { data: me, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, whatsapp, email, role')
        .eq('id', currentSession.user.id)
        .maybeSingle()

      if (!active) return

      if (profileError) {
        setError('Não foi possível carregar seus dados. Tente novamente.')
        setProfile(null)
        setLoading(false)
        return
      }

      const resolvedProfile: Profile = {
        full_name: me?.full_name ?? null,
        whatsapp: me?.whatsapp ?? null,
        email: me?.email ?? currentSession.user.email ?? null,
        role: me?.role ?? 'client'
      }

      setProfile(resolvedProfile)
      setFullName(resolvedProfile.full_name ?? '')
      setWhatsapp(resolvedProfile.whatsapp ?? '')
      setEmail(resolvedProfile.email ?? '')
      setLoading(false)
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    if (!session?.user?.id) {
      setError('Sua sessão expirou. Entre novamente para atualizar seus dados.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const userId = session.user.id
    const normalizedEmail = email.trim()
    const updates = {
      full_name: fullName.trim() || null,
      whatsapp: whatsapp.trim() || null,
      email: normalizedEmail || null
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (profileError) {
      setError('Não foi possível atualizar seus dados. Tente novamente.')
      setSaving(false)
      return
    }

    const authPayload: { email?: string; password?: string } = {}
    if (normalizedEmail && normalizedEmail !== session.user.email) {
      authPayload.email = normalizedEmail
    }
    if (password) {
      authPayload.password = password
    }

    if (Object.keys(authPayload).length > 0) {
      const { error: authError } = await supabase.auth.updateUser(authPayload)
      if (authError) {
        setError(authError.message || 'Não foi possível atualizar seus dados de acesso.')
        setSaving(false)
        return
      }
    }

    const { data: refreshed } = await supabase.auth.getSession()
    if (refreshed.session) {
      setSession(refreshed.session)
    }

    const updatedProfile: Profile = {
      full_name: updates.full_name,
      whatsapp: updates.whatsapp,
      email: updates.email,
      role: profile?.role ?? 'client'
    }

    setProfile(updatedProfile)
    setPassword('')
    setSuccess('Dados atualizados com sucesso.')
    setSaving(false)
  }

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError(null)

    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setSignOutError(signOutError.message || 'Não foi possível encerrar a sessão. Tente novamente.')
      setSigningOut(false)
      return
    }

    router.replace('/login')
    setSigningOut(false)
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6">
      <section className="card card--flush-top space-y-6">
        <div className="space-y-2">
          <span className="badge">Dados pessoais</span>
          <h1 className="text-3xl font-semibold text-[#1f2d28]">Meu perfil</h1>
          <p className="muted-text">
            Atualize seus dados de contato e senha sempre que precisar. Suas informações nos ajudam a manter tudo organizado.
          </p>
        </div>
        {loading ? (
          <div className="surface-muted text-center text-sm text-[color:rgba(31,45,40,0.7)]">Carregando…</div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="fullName">
                Nome completo
              </label>
              <input
                id="fullName"
                className="input-field"
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                disabled={saving}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                className="input-field"
                value={email}
                onChange={event => setEmail(event.target.value)}
                disabled={saving}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="whatsapp">
                WhatsApp
              </label>
              <input
                id="whatsapp"
                className="input-field"
                value={whatsapp}
                onChange={event => setWhatsapp(event.target.value)}
                disabled={saving}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="password">
                Nova senha
              </label>
              <input
                id="password"
                type="password"
                className="input-field"
                value={password}
                onChange={event => setPassword(event.target.value)}
                disabled={saving}
                placeholder="Deixe em branco para manter a atual"
                minLength={6}
              />
            </div>
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-2xl border border-[color:rgba(47,109,79,0.3)] bg-[color:rgba(247,242,231,0.7)] px-4 py-3 text-sm text-[#2f6d4f]">
                {success}
              </div>
            ) : null}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </form>
        )}
        <div className="space-y-3 rounded-3xl border border-[color:rgba(47,109,79,0.12)] bg-[color:rgba(247,242,231,0.6)] px-4 py-5 text-sm text-[color:rgba(31,45,40,0.8)]">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[#1f2d28]">Encerrar sessão</h2>
            <p>
              Finalize sua sessão com segurança quando terminar de atualizar seus dados ou revisar seus agendamentos.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="btn-secondary w-full justify-center"
          >
            {signingOut ? 'Saindo…' : 'Sair da conta'}
          </button>
          {signOutError ? (
            <p className="text-xs text-red-600">{signOutError}</p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
