# Garmin integration

## Status: modelled, not yet verified against the real API

The Garmin integration is complete on the Athlytic side (secure token storage, historical import, incremental sync,
normalization, raw storage) and runs end-to-end against a **deterministic fixture client**. The HTTP client
(`supabase/functions/_shared/garmin/client.ts`) is modelled on Garmin's published Health/Activity API summary
resources (`dailies`, `sleeps`, `stressDetails`, `hrv`, `userMetrics`, `activities`) with a pull window of 24 h of
upload time per request. **Endpoint paths, authentication scheme and field names have not been verified** because no
API access exists yet. Expect to adjust `client.ts`, `garmin/types.ts` and `garmin/normalize.ts` once a key is available.

## Access

- Garmin offers no self-service public API. Access is granted through the Garmin Connect Developer Program
  (application and approval; business-oriented). The user intends to apply for a Health API key.
- Unofficial libraries that log into Garmin Connect with a user's password violate the terms of service, break
  without notice and would require storing the Garmin password. They are **not used**.
- Garmin's Health API is push-oriented (webhooks) for production partners; the Personal API tier is pull-based. The
  code implements pull. If webhooks are granted, add a `garmin-webhook` edge function that calls the same
  `persist*` helpers in `_shared/server/sync.ts`.

## Modes

`GARMIN_MODE` in `supabase/functions/.env` (hosted: `supabase secrets set`):

| Mode | Behaviour |
| --- | --- |
| `fixture` (default) | Simulated data from 1 June 2025 onwards, built into the functions. No network. |
| `live` | `HttpGarminClient` calls `GARMIN_API_BASE_URL` with the stored token. |

## Security

- The token is sent once to the `garmin-connect` edge function over TLS, verified with the provider, and stored
  AES-256-GCM encrypted in `provider_credentials` (key: `CREDENTIAL_ENCRYPTION_KEY`, 32 random bytes, base64).
- `provider_credentials` and `raw_payloads` have RLS enabled and all client privileges revoked – even the user's own
  JWT cannot read them.
- Tokens never appear in frontend code, logs or responses. `garmin-disconnect` deletes the credentials.
- Rotate the encryption key by adding a `key_version` migration step (column exists; only version 1 is implemented).

## Sync

| Kind | Behaviour |
| --- | --- |
| `historical` | Walks backwards in 30-day chunks for up to 730 days, within a 20 s budget per invocation. The cursor `{nextTo}` is stored on the connection; the client calls again until `{done: true}`. |
| `incremental` | Re-fetches from `last_synced_at − 3 days` (or 7 days if never synced) because Garmin may revise recent days. |
| `activity-detail` | Fetches splits, GPS track and series for one activity on demand. |

Safeguards: a lock (`sync_state = 'syncing'` with expiry) prevents parallel runs; every run is logged in `sync_runs`;
401/403 sets the connection to `error` with `last_error`; rate-limit `Retry-After` is surfaced by `GarminApiError`.
Upserts are idempotent (unique keys per day / external id), duplicates are linked via `duplicate_of`.

## Data mapping

Garmin payloads are normalized into the provider-independent domain model in `_shared/domain.ts`
(daily metrics, sleep, intraday samples, activities, details). Original payloads are stored in `raw_payloads`
(versioned by hash), so normalization can be corrected and re-run without re-downloading.

Training load, recovery score and similar values that Garmin does not expose through the API are **calculated**
by Athlytic and labelled as estimates (see ANALYTICS.md).

## Checklist once an API key exists

1. Put the base URL in `GARMIN_API_BASE_URL`, set `GARMIN_MODE=live`.
2. Compare real responses with `garmin/types.ts`; adjust `normalize.ts`.
3. Confirm rate limits and window sizes; tune `WINDOW_DAYS` and the 20 s budget.
4. Confirm which authentication model applies (personal token vs. per-user OAuth) and adapt `garmin-connect`.
