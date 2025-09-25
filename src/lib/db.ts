import {
  createClient,
  type GenericSchema,
  type SupabaseClient
} from '@supabase/supabase-js'

type GenericDatabase = {
  public: GenericSchema
} & Record<string, GenericSchema>

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL')

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY')

export const supabase = createClient<GenericDatabase>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: { persistSession: true }
  }
)

let adminClient: SupabaseClient<GenericDatabase> | undefined

export function getSupabaseAdmin(): SupabaseClient<GenericDatabase> {
  if (typeof window !== 'undefined') {
    throw new Error('Supabase admin client is only available on the server')
  }

  if (!adminClient) {
    const adminUrl = process.env.SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE
    if (!adminUrl) throw new Error('Missing SUPABASE_URL for admin client')
    if (!serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE for admin client')
    adminClient = createClient<GenericDatabase>(adminUrl, serviceRole, {
      auth: { persistSession: false }
    })
  }

  return adminClient
}
