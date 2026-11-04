import { registerSW } from 'virtual:pwa-register'
import { useConnectivityStore } from '@/stores/connectivity'

/**
 * Registers the service worker with prompt-based updates: a new version is downloaded in the background and only
 * activated when the user confirms, so a reload never happens in the middle of editing or syncing.
 */
export function registerServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      useConnectivityStore.getState().setUpdateReady(() => updateSW(true))
    },
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    },
  })
}
