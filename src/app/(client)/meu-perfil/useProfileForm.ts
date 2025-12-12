"use client"

import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

import { useClientSessionGuard } from '@/hooks/useClientSessionGuard'
import { supabase } from '@/lib/db'

import type { Profile } from './types'

export function useProfileForm() {
  const router = useRouter()
  const { session: guardSession, isReady: isSessionReady } = useClientSessionGuard()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  useEffect(() => {
    setSession(guardSession ?? null)
  }, [guardSession])

  useEffect(() => {
    if (!isSessionReady) return
    if (!guardSession?.user?.id) {
      setLoading(false)
      return
    }

    let active = true
    const loadProfile = async () => {
      setLoading(true)
      setError(null)

      const user = guardSession.user
      const { data: me, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, whatsapp, email, birth_date, role')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return

      if (profileError) {
        console.error('Erro ao carregar perfil', profileError)
      }

      let resolvedProfile = me ?? null

      if (!me) {
        const seedProfile = {
          id: user.id,
          email: user.email ?? null,
          full_name: (user.user_metadata as Record<string, string | null> | null)?.full_name ?? null,
          whatsapp: (user.user_metadata as Record<string, string | null> | null)?.whatsapp ?? null,
          birth_date: (user.user_metadata as Record<string, string | null> | null)?.birth_date ?? null,
          role: 'client' as const,
        }

        const { data: upserted, error: upsertError } = await supabase
          .from('profiles')
          .upsert(seedProfile, { onConflict: 'id' })
          .select('full_name, whatsapp, email, birth_date, role')
          .maybeSingle()

        if (!active) return

        if (upsertError) {
          console.error('Erro ao criar perfil', upsertError)
          resolvedProfile = seedProfile
        } else {
          resolvedProfile = upserted ?? seedProfile
        }
      }

      const fallbackFullName =
        (user.user_metadata as Record<string, string | null> | null)?.full_name ?? ''
      const fallbackWhatsapp =
        (user.user_metadata as Record<string, string | null> | null)?.whatsapp ?? ''
      const fallbackBirthDate =
        (user.user_metadata as Record<string, string | null> | null)?.birth_date ?? ''
      const fallbackEmail = user.email ?? ''

      setProfile(resolvedProfile)
      setFullName(resolvedProfile?.full_name ?? fallbackFullName)
      setEmail(resolvedProfile?.email ?? fallbackEmail)
      setWhatsapp(resolvedProfile?.whatsapp ?? fallbackWhatsapp)
      setBirthDate(resolvedProfile?.birth_date ?? fallbackBirthDate)
      setLoading(false)

      if (profileError && !resolvedProfile) {
        setError('Não foi possível carregar seus dados. Tente novamente.')
      }
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [guardSession, isSessionReady])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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
        email: normalizedEmail || null,
        birth_date: birthDate || null,
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

      const authPayload: { email?: string; password?: string; data?: Record<string, unknown> } = {
        data: {
          full_name: updates.full_name,
          whatsapp: updates.whatsapp,
          birth_date: updates.birth_date,
        },
      }
      if (normalizedEmail && normalizedEmail !== session.user.email) {
        authPayload.email = normalizedEmail
      }
      if (password) {
        authPayload.password = password
      }

      if (Object.keys(authPayload).length > 0 || authPayload.data) {
        const { error: authError } = await supabase.auth.updateUser(authPayload)
        if (authError) {
          setError(
            authError.message || 'Não foi possível atualizar seus dados de acesso.',
          )
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
        birth_date: updates.birth_date,
        role: profile?.role ?? 'client',
      }

      setProfile(updatedProfile)
      setPassword('')
      setSuccess('Dados atualizados com sucesso.')
      setSaving(false)
    },
    [birthDate, email, fullName, password, profile?.role, saving, session?.user?.email, session?.user?.id, whatsapp],
  )

  const handleSignOut = useCallback(async () => {
    if (signingOut) return

    setSigningOut(true)
    setSignOutError(null)

    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setSignOutError(
        signOutError.message || 'Não foi possível encerrar a sessão. Tente novamente.',
      )
      setSigningOut(false)
      return
    }

    router.replace('/login')
    setSigningOut(false)
  }, [router, signingOut])

  return {
    session,
    profile,
    fullName,
    setFullName,
    email,
    setEmail,
    whatsapp,
    setWhatsapp,
    birthDate,
    setBirthDate,
    password,
    setPassword,
    loading,
    saving,
    error,
    setError,
    success,
    setSuccess,
    signingOut,
    signOutError,
    handleSubmit,
    handleSignOut,
    setProfile,
  }
}
