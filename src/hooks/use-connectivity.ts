import { useEffect } from 'react'
import { useConnectivityStore } from '@/stores/connectivity'

/** Subscribes the connectivity store to browser online/offline events. Mount once at the root. */
export function useConnectivityListener(onReconnect: () => void) {
  const setOnline = useConnectivityStore((s) => s.setOnline)

  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      onReconnect()
    }
    const goOffline = () => setOnline(false)
    // iOS has no Background Sync, so the app also syncs when it returns to the foreground.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) onReconnect()
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [setOnline, onReconnect])
}
