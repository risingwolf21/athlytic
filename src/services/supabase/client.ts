import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseConfig } from '@/lib/env'

let client: SupabaseClient | null = null

/** Single shared browser client. Session persistence and token refresh are handled by supabase-js. */
export function getSupabase(): SupabaseClient {
  client ??= createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  })
  return client
}
