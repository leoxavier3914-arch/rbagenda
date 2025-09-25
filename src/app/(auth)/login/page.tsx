'use client'

import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import { useRouter } from 'next/navigation'

export default function Login(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [msg,setMsg]=useState('');
  const [loading,setLoading]=useState(false);
  const [checkingSession, setCheckingSession] = useState(true)
  const router=useRouter()

  useEffect(()=>{
    let active = true

    async function verifySession(){
      const { data } = await supabase.auth.getSession()
      if (!active) return

      if (data.session){
        router.replace('/dashboard')
        return
      }

      setCheckingSession(false)
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session)=>{
      if (!active) return
      if (session){
        router.replace('/dashboard')
      }
    })

    verifySession()

    return ()=>{
      active = false
      subscription.subscription.unsubscribe()
    }
  },[router])

  async function submit(e: FormEvent<HTMLFormElement>){
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setMsg('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error){
      setMsg(error.message)
      setLoading(false)
      return
    }

    router.replace('/dashboard')
    setLoading(false)
  }

  if (checkingSession){
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <span className="text-sm text-gray-500">Verificando sessão…</span>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <form className="space-y-3" onSubmit={submit}>
        <input className="w-full border p-2 rounded" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} disabled={loading} />
        <input className="w-full border p-2 rounded" type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} />
        <button className="w-full bg-black text-white py-2 rounded disabled:opacity-60 disabled:cursor-not-allowed" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </main>
  )
}
