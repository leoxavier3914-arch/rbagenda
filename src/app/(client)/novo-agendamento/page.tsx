'use client'

import { useEffect } from 'react'

import { supabase } from '@/lib/db'

import NewAppointmentExperience from './NewAppointmentExperience'

export default function NewAppointment() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = '/login'
      }
    })
  }, [])

  return <NewAppointmentExperience />
}
