import { NextRequest } from 'next/server'
import { supabaseAdmin } from './db'

export async function getUserFromRequest(req: NextRequest) {
  const hdr = req.headers.get('authorization') || ''
  const token = hdr.toLowerCase().startsWith('bearer ')? hdr.slice(7): null
  if (!token) return null
  const { data } = await supabaseAdmin.auth.getUser(token)
  return data.user || null
}
