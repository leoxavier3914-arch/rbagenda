export type SupportChannel = {
  label: string
  value: string
  helper?: string
  actionLabel?: string
  actionHref?: string
}

export type SupportThread = {
  id: string
  status: 'open' | 'closed' | 'escalated'
  last_message_preview: string | null
  last_actor: 'user' | 'staff' | 'assistant' | null
  created_at: string
  updated_at: string
  user_id?: string | null
  branch_id?: string | null
}

export type SupportMessage = {
  id: string
  thread_id: string
  sender_type: 'user' | 'staff' | 'assistant'
  message: string
  created_at: string
}
