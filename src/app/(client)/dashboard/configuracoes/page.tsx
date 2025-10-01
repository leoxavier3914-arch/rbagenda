'use client'

import { useState } from 'react'

const preferenceOptions = [
  {
    key: 'reminders',
    label: 'Receber lembretes por e-mail',
    description: 'Seja avisada automaticamente sobre seus próximos agendamentos.',
  },
  {
    key: 'news',
    label: 'Novidades e promoções',
    description: 'Fique por dentro de lançamentos, condições especiais e bastidores do estúdio.',
  },
]

export default function DashboardSettingsPage() {
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    reminders: true,
    news: false,
  })

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <section className="card space-y-5">
        <div className="space-y-3">
          <span className="badge">Seu jeito</span>
          <h1 className="text-3xl font-semibold text-[#1f2d28] sm:text-4xl">Configurações</h1>
          <p className="muted-text">
            Personalize notificações e preferências de contato. As alterações são salvas automaticamente.
          </p>
        </div>
        <form className="space-y-4">
          {preferenceOptions.map((option) => {
            const isChecked = preferences[option.key]
            return (
              <label
                key={option.key}
                className="flex cursor-pointer flex-col gap-2 rounded-3xl border border-white/40 bg-white/90 p-5 shadow-sm transition hover:border-white/60 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-semibold text-[#1f2d28]">{option.label}</span>
                    <p className="text-sm text-[color:rgba(31,45,40,0.7)]">{option.description}</p>
                  </div>
                  <input
                    checked={isChecked}
                    className="h-5 w-5 rounded border border-emerald-300 text-emerald-600"
                    onChange={() =>
                      setPreferences((current) => ({
                        ...current,
                        [option.key]: !isChecked,
                      }))
                    }
                    type="checkbox"
                  />
                </div>
              </label>
            )
          })}
        </form>
      </section>
    </div>
  )
}
