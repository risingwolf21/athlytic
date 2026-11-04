# ADR 0004 – Offline cache and prompt-based updates

**Status**: accepted

**Decision**: The app shell is precached by Workbox; query data is persisted to IndexedDB (7 days). The service worker
uses `registerType: 'prompt'` so updates activate only after the user confirms. Sync is triggered on start, reconnect
and foreground because iOS lacks Background Sync. Offline user edits are not queued (MVP).

**Consequences**: No surprise reloads or lost state. Data freshness offline equals the last successful sync.
