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
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-16">
      <div className="card w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <span className="badge inline-flex">Boas-vindas</span>
          <h1 className="text-3xl font-semibold text-[#1f2d28]">Criar conta</h1>
          <p className="muted-text">
            Cadastre-se para reservar horários com praticidade e receber lembretes automáticos.
          </p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1 text-left">
            <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="full_name">
              Nome completo
            </label>
            <input
              id="full_name"
              className="input-field"
              placeholder="Como devemos te chamar?"
              value={full_name}
              onChange={e=>setFull(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="whatsapp">
              WhatsApp (com DDD)
            </label>
            <input
              id="whatsapp"
              className="input-field"
              placeholder="(00) 00000-0000"
              value={whatsapp}
              onChange={e=>setWa(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="signup-email">
              E-mail
            </label>
            <input
              id="signup-email"
              className="input-field"
              placeholder="nome@email.com"
              value={email}
              onChange={e=>setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="text-sm font-medium text-[color:rgba(31,45,40,0.8)]" htmlFor="signup-password">
              Senha
            </label>
            <input
              id="signup-password"
              className="input-field"
              type="password"
              placeholder="Crie uma senha segura"
              value={password}
              onChange={e=>setPassword(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full">Criar conta</button>
        </form>
        {msg && (
          <div className="rounded-2xl border border-[color:rgba(47,109,79,0.4)] bg-[color:rgba(247,242,231,0.7)] px-4 py-3 text-sm text-[#2f6d4f]">
            {msg}
          </div>
        )}
      </div>
    </main>
  )
}
