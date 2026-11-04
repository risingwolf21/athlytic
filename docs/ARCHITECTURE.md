# Architecture

```
React UI (features/, components/)
   │  TanStack Query hooks (hooks/use-fitness-data.ts)
   ▼
Repository interface (services/data/repository.ts)
   ├─ demo implementation   – fixtures → normalizers in the browser (no backend; GitHub Pages)
   └─ Supabase implementation – PostgREST + RLS, edge functions for connect/sync
                                   │
                                   ▼
                    Edge functions (Deno)  ──►  DataProvider (Garmin | future: Apple Health export, FIT, CSV)
                                   │
                                   ▼
                              PostgreSQL (RLS)
```

## Principles

- **Separation**: UI never calls Supabase directly and never calculates metrics. Hooks call the repository;
  features call the pure `src/analytics` module.
- **Provider independence**: providers implement `DataProvider` (`verify`, `fetchRange`, `fetchActivityDetail`) and
  return a `NormalizedBundle`. Merging, priorities, storage and sync orchestration live in `_shared/merge.ts`
  and `_shared/server/sync.ts`.
- **Shared code**: `supabase/functions/_shared/` is dependency-free TypeScript used by both Vite (alias `@shared`) and
  Deno. `_shared/server/` is Deno-only and excluded from the app's `tsconfig`.
- **Secrets only on the server**: the browser has only the Supabase URL and anon key. Provider tokens live
  encrypted in a table that clients cannot read.
- **Two data modes** (`src/lib/env.ts`): `supabase` if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set,
  otherwise `demo`. Demo mode keeps the app fully usable and is what GitHub Pages serves.

## Folder structure

```
src/
  app/            providers, router, PWA registration
  components/     ui/ (shadcn), charts/ (custom SVG + Recharts), layout/, metric cards
  features/       dashboard, analytics, activities, recovery, insights, integrations, settings, auth
  analytics/      pure calculations (see ANALYTICS.md)
  hooks/ lib/ stores/ i18n/ services/ types/
supabase/
  migrations/     schema + RLS
  functions/      garmin-connect, garmin-disconnect, garmin-sync, _shared/
docs/             PLAN, ARCHITECTURE, ANALYTICS, GARMIN, adr/
```

## State

- **Server state**: TanStack Query. The cache is persisted to IndexedDB for 7 days and keyed by a buster that
  includes the data mode, so demo and real data never mix.
- **Client state**: Zustand (`auth`, `theme`, `connectivity`, `ui`).
- **Validation**: Zod validates rows coming from Supabase at the data-layer boundary (`services/supabase/rows.ts`).

## Sync flow

1. Settings → connect: token → `garmin-connect` (verify, encrypt, store).
2. Client calls `garmin-sync {historical}` repeatedly until `{done: true}`, invalidating queries after each slice.
3. Incremental sync runs on app start, on reconnect and when the app returns to the foreground
   (iOS has no Background Sync).
4. Activity details are fetched lazily when a detail page is opened.

## PWA

`vite-plugin-pwa` (generateSW, Workbox) precaches the app shell; OSM tiles are cached as they are viewed.
`registerType: 'prompt'` means a new service worker waits until the user accepts the update, so in-progress
interaction is never interrupted. Offline, the persisted query cache serves the last synchronized data and sync
actions are disabled with a visible status indicator. Safe areas use `env(safe-area-inset-*)` and `100dvh`.

## Decisions

Recorded in [adr/](adr/).
