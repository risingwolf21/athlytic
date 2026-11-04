# Athlytic

A premium, mobile-first fitness intelligence PWA: an analytical companion to Garmin Connect with baselines,
recovery, training load, correlations and transparent insights. German UI, metric units, light/dark themes.

React 19 · Vite · TypeScript (strict) · Tailwind v4 · shadcn/ui · Recharts · Motion · TanStack Query · Zustand ·
Supabase · Zod · vite-plugin-pwa (Workbox) · Leaflet/OSM.

## Quick start (demo mode, no backend)

```bash
npm install
npm run dev        # http://localhost:5173
```

Without Supabase environment variables the app runs in **demo mode** with simulated Garmin data (fixtures), so
every screen is explorable. This is also what the GitHub Pages build serves.

## Local backend (Supabase)

Requires Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase start                       # ports 55xxx, see supabase/config.toml
cp .env.example .env.local           # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from `supabase status`
cp supabase/functions/.env.example supabase/functions/.env
openssl rand -base64 32              # paste as CREDENTIAL_ENCRYPTION_KEY in supabase/functions/.env
supabase functions serve --env-file supabase/functions/.env
npm run dev
```

Sign up in the app, open *Einstellungen*, enter any token (fixture mode) and import the history.
`GARMIN_MODE=live` switches to the real Garmin API once you have access – see [docs/GARMIN.md](docs/GARMIN.md).

The local stack uses ports 55321–55329 so it does not collide with a default Supabase install (54321–54329).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check, build, create SPA `404.html` |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |
| `npm run check:i18n` | Verify translation keys |
| `npm run icons` | Regenerate PWA icons and iOS splash screens |

## Deployment (GitHub Pages)

`.github/workflows/pages.yml` builds in demo mode with `VITE_BASE=/<repository>/` and publishes `dist/`.
To use a real backend, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository variables (or secrets) and
host the functions on a Supabase project (note: a hosted project may incur costs).

## Installing on a phone

- **iOS (Safari)**: Share → *Zum Home-Bildschirm*.
- **Android (Chrome)**: *Installieren* in *Einstellungen*, or the browser menu.

## Documentation

- [docs/PLAN.md](docs/PLAN.md) – PWA limits, feasibility, schema, MVP, open decisions
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/ANALYTICS.md](docs/ANALYTICS.md) – formulas and rules
- [docs/GARMIN.md](docs/GARMIN.md) – integration status and security
- [docs/adr/](docs/adr/) – architecture decisions
