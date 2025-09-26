'use client'

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
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-2xl font-semibold">Tudo certo! 🎉</h1>
        <p>{msg}</p>
      </div>
    </main>
  )
}
