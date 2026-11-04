import { create } from 'zustand'
import { dataMode } from '@/lib/env'
import { getSupabase } from '@/services/supabase/client'

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

interface AuthState {
  status: AuthStatus
  email: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>(() => ({
  status: dataMode === 'demo' ? 'signedIn' : 'loading',
  email: dataMode === 'demo' ? 'demo@athlytic.app' : null,
  signIn: async (email, password) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) throw error
  },
  signUp: async (email, password) => {
    const { data, error } = await getSupabase().auth.signUp({ email, password })
    if (error) throw error
    // With email confirmation enabled there is no session yet.
    if (!data.session) throw new Error('CONFIRM_EMAIL')
  },
  signOut: async () => {
    await getSupabase().auth.signOut()
  },
}))

/** Mirrors the Supabase session into the store. Returns an unsubscribe function. */
export function startAuthListener(onSignedOut: () => void): () => void {
  if (dataMode === 'demo') return () => undefined
  const supabase = getSupabase()

  void supabase.auth.getSession().then(({ data }) => {
    useAuthStore.setState({ status: data.session ? 'signedIn' : 'signedOut', email: data.session?.user.email ?? null })
  })

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.setState({ status: session ? 'signedIn' : 'signedOut', email: session?.user.email ?? null })
    if (event === 'SIGNED_OUT') onSignedOut()
  })
  return () => data.subscription.unsubscribe()
}
