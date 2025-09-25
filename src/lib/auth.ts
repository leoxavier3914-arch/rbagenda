import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from './db'

const supabaseAdmin = getSupabaseAdmin()

export async function getUserFromRequest(req: NextRequest) {
  const hdr = req.headers.get('authorization') || ''
  const token = hdr.toLowerCase().startsWith('bearer ')? hdr.slice(7): null
  if (!token) return null
  const { data } = await supabaseAdmin.auth.getUser(token)
  return data.user || null
}
