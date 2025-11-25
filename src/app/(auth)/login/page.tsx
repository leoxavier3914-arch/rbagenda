'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

export default function Login(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [msg,setMsg]=useState('');
  const [loading,setLoading]=useState(false);
  const [checkingSession, setCheckingSession] = useState(true)
  const router=useRouter()

  const redirectByRole = useCallback(async (session: Session | null) => {
    if (!session?.user?.id) return

    router.replace('/meu-perfil')
  }, [router])

  useEffect(()=>{
    let active = true

    async function verifySession(){
      const { data } = await supabase.auth.getSession()
      if (!active) return

      if (data.session){
        redirectByRole(data.session)
        return
      }

      setCheckingSession(false)
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session)=>{
      if (!active) return
      if (session){
        redirectByRole(session)
      } else {
        setCheckingSession(false)
      }
    })

    verifySession()

    return ()=>{
      active = false
      subscription.subscription.unsubscribe()
    }
  },[redirectByRole])

  async function submit(e: FormEvent<HTMLFormElement>){
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setMsg('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error){
      setMsg(error.message)
      setLoading(false)
      return
    }

    if (data.session){
      await redirectByRole(data.session)
    } else {
      setMsg('Sessão não disponível. Verifique seu acesso e tente novamente.')
    }

    setLoading(false)
  }

  if (checkingSession){
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-10">
      <div className="card text-center text-sm text-[color:rgba(31,45,40,0.8)]">
          Verificando sessão…
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-16">
      <div className="card w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <span className="badge inline-flex">Bem-vinda de volta</span>
          <h1 className="text-3xl font-semibold text-[#1f2d28]">Acessar conta</h1>
          <p className="muted-text">
            Entre para acompanhar seus agendamentos e garantir uma rotina mais tranquila.
          </p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1 text-left">
            <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              className="input-field"
              placeholder="nome@email.com"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              className="input-field"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        {msg && (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
            {msg}
          </div>
        )}
      </div>
    </main>
  )
}
