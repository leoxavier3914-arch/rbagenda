'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '@/lib/db'
import { useRouter } from 'next/navigation'

export default function Login(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [msg,setMsg]=useState('')
  const router=useRouter()

  async function submit(e: FormEvent<HTMLFormElement>){
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return setMsg(error.message)
    router.push('/dashboard')
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <form className="space-y-3" onSubmit={submit}>
        <input className="w-full border p-2 rounded" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border p-2 rounded" type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-black text-white py-2 rounded">Entrar</button>
      </form>
      {msg && <p>{msg}</p>}
    </main>
  )
}
