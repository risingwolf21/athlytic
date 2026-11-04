import { create } from 'zustand'

interface ConnectivityState {
  online: boolean
  /** A new service worker is installed and waiting; applying it reloads the page. */
  updateReady: boolean
  applyUpdate: (() => Promise<void>) | null
  setOnline: (online: boolean) => void
  setUpdateReady: (apply: () => Promise<void>) => void
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  updateReady: false,
  applyUpdate: null,
  setOnline: (online) => set({ online }),
  setUpdateReady: (apply) => set({ updateReady: true, applyUpdate: apply }),
}))
