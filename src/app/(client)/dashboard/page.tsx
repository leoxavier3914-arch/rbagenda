'use client'

import Link from 'next/link'
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

  const role = profile?.role === 'admin' ? 'admin' : 'client'

  return (
    <main className="max-w-md mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        {loading ? (
          <p className="mt-3 text-sm text-gray-600">Carregando…</p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="fullName">
                Nome completo
              </label>
              <input
                id="fullName"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                disabled={saving}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                value={email}
                onChange={event => setEmail(event.target.value)}
                disabled={saving}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="whatsapp">
                WhatsApp
              </label>
              <input
                id="whatsapp"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                value={whatsapp}
                onChange={event => setWhatsapp(event.target.value)}
                disabled={saving}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="password">
                Nova senha
              </label>
              <input
                id="password"
                type="password"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                value={password}
                onChange={event => setPassword(event.target.value)}
                disabled={saving}
                placeholder="Deixe em branco para manter a atual"
                minLength={6}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
            <button
              type="submit"
              className="w-full rounded border border-black px-4 py-2 text-sm font-medium text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </form>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Agendamentos</h2>
        {role === 'admin' ? (
          <p className="text-sm text-gray-600">
            Você continua tendo acesso ao painel administrativo, mas também pode gerenciar seus dados pessoais aqui.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            Gerencie seus agendamentos e marque novos horários quando precisar.
          </p>
        )}
        <Link
          href="/dashboard/novo-agendamento"
          className="block rounded border border-black px-4 py-3 text-center text-sm font-medium text-black transition hover:bg-black hover:text-white"
        >
          Novo agendamento
        </Link>
        <Link
          href="/dashboard/agendamentos"
          className="block rounded border border-black px-4 py-3 text-center text-sm font-medium text-black transition hover:bg-black hover:text-white"
        >
          Meus agendamentos
        </Link>
      </div>
    </main>
  )
}
