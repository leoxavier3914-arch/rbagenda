import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL')

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY')

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: { persistSession: true }
  }
)

let adminClient: ReturnType<typeof createClient> | undefined
if (typeof window === 'undefined') {
  const adminUrl = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE
  if (!adminUrl) throw new Error('Missing SUPABASE_URL for admin client')
  if (!serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE for admin client')
  adminClient = createClient(adminUrl, serviceRole, { auth: { persistSession: false } })
}

export const supabaseAdmin = adminClient
