import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

const DB_NAME = 'athlytic'
const STORE = 'query-cache'
const KEY = 'client'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

/**
 * Stores the TanStack Query cache (including paused offline mutations) in IndexedDB. IndexedDB instead of
 * localStorage because a year of daily records plus activities is far beyond the ~5 MB localStorage limit.
 */
export const idbPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await run('readwrite', (store) => store.put(client, KEY))
  },
  restoreClient: async () => (await run<PersistedClient | undefined>('readonly', (store) => store.get(KEY))) ?? undefined,
  removeClient: async () => {
    await run('readwrite', (store) => store.delete(KEY))
  },
}
