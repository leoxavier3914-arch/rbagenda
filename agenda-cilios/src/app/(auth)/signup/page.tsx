'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '@/lib/db'

export default function SignUp() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [full_name,setFull]=useState('');
  const [whatsapp,setWa]=useState('')
  const [msg,setMsg]=useState('')

  async function submit(e: FormEvent<HTMLFormElement>){
    e.preventDefault()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return setMsg(error.message)

    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    const uid = session?.user.id || data.user?.id
    if (uid) {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/rest/v1/profiles`, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ id: uid, email, full_name, whatsapp, role: 'client' })
      })
    }

    setMsg('Verifique seu e-mail para confirmar o cadastro.')
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Criar conta</h1>
      <form className="space-y-3" onSubmit={submit}>
        <input className="w-full border p-2 rounded" placeholder="Nome completo" value={full_name} onChange={e=>setFull(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="WhatsApp (com DDD)" value={whatsapp} onChange={e=>setWa(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border p-2 rounded" type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-black text-white py-2 rounded">Criar</button>
      </form>
      {msg && <p>{msg}</p>}
    </main>
  )
}
