import { LashIcon } from '@/components/client/LashIcon'
import { ClientGlassPanel } from '@/components/client/ClientPageLayout'

import type { SelectedStatusCategory, StatusCategory } from '../types'

const statusCards: Array<{ key: StatusCategory; title: string }> = [
  { key: 'ativos', title: 'Ativos' },
  { key: 'pendentes', title: 'Pendentes' },
  { key: 'cancelados', title: 'Cancelados' },
  { key: 'concluidos', title: 'Concluídos' },
]

type StatusFiltersBarProps = {
  selectedCategory: SelectedStatusCategory
  onSelect: (category: StatusCategory) => void
}

export function StatusFiltersBar({ selectedCategory, onSelect }: StatusFiltersBarProps) {
  return (
    <ClientGlassPanel label="STATUS">
      <div className="grid tipo-grid" role="group" aria-label="Filtro de agendamentos">
        {statusCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className="card"
            data-active={selectedCategory === card.key ? 'true' : 'false'}
            onClick={() => onSelect(card.key)}
          >
            <div className="card-inner">
              <LashIcon />
              <span>{card.title}</span>
            </div>
          </button>
        ))}
      </div>
    </ClientGlassPanel>
  )
}
