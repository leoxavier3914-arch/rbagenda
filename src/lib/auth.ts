import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from './db'

const supabaseAdmin = getSupabaseAdmin()

function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim())
  return match?.[1]?.trim() ?? null
}

export async function getUserFromRequest(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) {
    console.error('Erro ao obter usuário autenticado', error)
    return null
  }

  return data.user || null
}
