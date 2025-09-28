'use client'
import { useEffect } from 'react'
import BookingFlow from '@/components/BookingFlow'
import { supabase } from '@/lib/db'
import styles from './page.module.css'

export default function NewAppointment() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = '/login'
      }
    })
  }, [])

  return (
    <main className={styles.main}>
      <div className={styles.shell}>
        <header className={styles.intro}>
          <h1 className={styles.title}>Novo agendamento</h1>
          <p className={styles.subtitle}>
            Escolha o tipo de serviço, data e horário ideais. O valor e o sinal são atualizados automaticamente.
          </p>
        </header>
        <BookingFlow />
      </div>
    </main>
  )
}
