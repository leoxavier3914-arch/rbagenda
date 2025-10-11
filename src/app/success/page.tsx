'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Success(){
  const [msg,setMsg]=useState('Processando…')

  useEffect(()=>{
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    const sessionId = params.get('session_id');

    if (ref) {
      setMsg(`Pagamento recebido/pendente para ${ref}.`);
    } else if (sessionId) {
      setMsg(`Pagamento recebido/pendente. Session ID: ${sessionId}.`);
    } else {
      setMsg('Obrigado!');
    }
  },[])

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-16">
      <div className="card w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <span className="badge inline-flex">Pagamento</span>
          <h1 className="text-3xl font-semibold text-[#1f2d28]">Tudo certo! 🎉</h1>
          <p className="muted-text">{msg}</p>
        </div>
        <Link href="/agendamentos" className="btn-primary w-full">
          Ver meus agendamentos
        </Link>
      </div>
    </main>
  )
}
