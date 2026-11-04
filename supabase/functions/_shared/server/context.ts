import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { HttpError } from './http.ts'

export type Db = SupabaseClient

/** Service-role client: bypasses RLS, so every query must filter by the authenticated user id itself. */
export function createServiceClient(): Db {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase environment is not configured')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Verifies the caller's JWT with Supabase Auth and returns the user id. */
export async function authenticate(req: Request, db: Db): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Not signed in')
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Not signed in')
  return data.user.id
}
