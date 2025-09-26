'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import AppHeader from '@/components/AppHeader'

type Profile = {
  full_name?: string
  whatsapp?: string
  email?: string
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) {
        window.location.href = '/login'
        return
      }

      const me = await fetch('/rest/v1/profiles?id=eq.' + sess.session?.user.id, {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${token}`
        }
      }).then(r => r.json() as Promise<Profile[]>)

      setProfile(me[0] ?? null)
      setLoading(false)
    })()
  }, [])

  return (

    <>
      <AppHeader />
      <main className="max-w-md mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        {profile && (
          <div className="p-3 border rounded">
            <div><b>Nome:</b> {profile.full_name}</div>
            <div><b>WhatsApp:</b> {profile.whatsapp}</div>
            <div><b>E-mail:</b> {profile.email}</div>
          </div>
        )}

        <h2 className="text-xl font-semibold">Meus agendamentos</h2>
        <div className="space-y-2">
          {appts.map(a=> (
            <div key={a.id} className="p-3 border rounded">
              <div><b>Serviço:</b> {a.services?.name}</div>
              <div><b>Data:</b> {new Date(a.starts_at).toLocaleString()}</div>
              <div><b>Status:</b> {a.status}</div>
            </div>
          ))}
        </div>
      </main>
    </>

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
