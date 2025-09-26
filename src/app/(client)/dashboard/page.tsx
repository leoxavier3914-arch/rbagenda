'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/db'

type Profile = {
  full_name?: string
  whatsapp?: string
  email?: string
  role?: 'admin' | 'client'
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let active = true

    ;(async () => {
      const { data: sess } = await supabase.auth.getSession()
      if (!active) return

      const session = sess.session
      if (!session) {
        router.replace('/login')
        return
      }

      const { data: me } = await supabase
        .from('profiles')
        .select('full_name, whatsapp, email, role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!active) return

      const role = me?.role === 'admin' ? 'admin' : 'client'
      if (role !== 'admin') {
        router.replace('/dashboard/novo-agendamento')
        return
      }

      setProfile(me ?? null)
      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [router])

  return (
    <main className="max-w-md mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        {loading ? (
          <p>Carregando…</p>
        ) : profile ? (
          <div className="mt-3 space-y-1 rounded border p-3">
            <div>
              <b>Nome:</b> {profile.full_name}
            </div>
            <div>
              <b>WhatsApp:</b> {profile.whatsapp}
            </div>
            <div>
              <b>E-mail:</b> {profile.email}
            </div>
          </div>
        ) : (
          <p>Não foi possível carregar seus dados.</p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Agendamentos</h2>
        <Link
          href="/dashboard/novo-agendamento"
          className="block rounded border border-black px-4 py-3 text-center font-medium text-black hover:bg-black hover:text-white"
        >
          Novo agendamento
        </Link>
        <Link
          href="/dashboard/agendamentos"
          className="block rounded border border-black px-4 py-3 text-center font-medium text-black hover:bg-black hover:text-white"
        >
          Meus agendamentos
        </Link>
      </div>
    </main>
  )
}
