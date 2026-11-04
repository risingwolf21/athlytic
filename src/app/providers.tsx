import { useCallback, useEffect, type ReactNode } from 'react'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useAuthStore, startAuthListener } from '@/stores/auth'
import { useThemeStore, applyTheme } from '@/stores/theme'
import { useConnectivityListener } from '@/hooks/use-connectivity'
import { Toaster } from '@/components/ui/sonner'
import { queryClient, WEEK_MS } from '@/services/data/query-client'
import { idbPersister } from '@/services/data/persistence'
import { dataMode } from '@/lib/env'

function ThemeSync() {
  const preference = useThemeStore((s) => s.preference)
  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])
  return null
}

/** Auth, connectivity and cache lifecycle wiring. Renders nothing. */
function Lifecycle() {
  const status = useAuthStore((s) => s.status)

  useEffect(
    () =>
      startAuthListener(() => {
        // Never leave one user's cached health data behind for the next sign-in.
        queryClient.clear()
        void idbPersister.removeClient()
      }),
    [],
  )

  const onReconnect = useCallback(() => {
    if (status !== 'signedIn') return
    void queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries())
  }, [status])
  useConnectivityListener(onReconnect)

  return null
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: idbPersister, maxAge: WEEK_MS, buster: `athlytic-${dataMode}-2` }}
      onSuccess={() => void queryClient.resumePausedMutations()}
    >
      <ThemeSync />
      <Lifecycle />
      {children}
      <Toaster />
    </PersistQueryClientProvider>
  )
}
