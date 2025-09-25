'use client'

import { useEffect, useState } from 'react'

export default function Success(){
  const [msg,setMsg]=useState('Processando…')

  useEffect(()=>{
    const ref=new URLSearchParams(location.search).get('ref');
    setMsg(ref?`Pagamento recebido/pendente para ${ref}.`:'Obrigado!')
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
