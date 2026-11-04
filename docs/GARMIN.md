# Garmin integration

## Status: implemented against the official Personal API spec

`HttpGarminClient` (`supabase/functions/_shared/garmin/client.ts`) targets the **Garmin Connect Personal API**
(OpenAPI spec: https://developer.garmin.com/gc-developer-program/personal/swagger-docs/). Endpoints and field names
come from that spec; request/response handling is covered by mocked-fetch tests
(`deno test supabase/functions/_shared/garmin/garmin.test.ts`). It has not yet run against a live account – the first
real import may reveal small differences (token response shape, optional fields); the connect toast and `sync_runs`
show the HTTP status if something is rejected. Demo/fixture mode uses a deterministic fixture client instead.

## Access

- The **Personal API** gives individual Garmin Connect users read access to their own data with a self-issued API key.
  The business-oriented Health/Activity API (webhooks, partner approval) is not used.
- Unofficial libraries that log into Garmin Connect with a user's password violate the terms of service, break
  without notice and would require storing the Garmin password. They are **not used**.
- The Personal API is pull-based and the code implements pull. If webhooks are granted, add a `garmin-webhook` edge function that calls the same
  `persist*` helpers in `_shared/server/sync.ts`.


## Personal API authentication

1. Create a personal API key at `connect.garmin.com/app/settings/personalApiToken` (you choose its expiry).
2. Exchange it for an access token:
   `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token`
   with the header `Authorization: ApiKey <key>`.
3. Call data endpoints with the header `Authorization: Bearer <access token>`.

The API key itself is **not** a bearer token (it yields `401 invalid_token`). `HttpGarminClient` stores only the API
key (encrypted), exchanges it per sync run, caches the access token and re-exchanges it once on a 401. The token
response is parsed leniently (JSON with `access_token`/`accessToken`/`token`, or a bare string).

If connecting fails, the toast shows the status: 401 = key rejected/expired, 403 = missing permission,
404 = wrong base URL (use `https://personal.connectapi.garmin.com`, or `.garmin.cn` for China).

## Endpoints used

| Data | Endpoint | Notes |
| --- | --- | --- |
| Connection check | `GET /userprofile-service/userprofile/settings` | `displayName` is stored as the external user id |
| Daily summary (steps, calories, HR, stress, Body Battery, intensity minutes) | `GET /usersummary-service/v2/dailysummaries?startDate&endDate` | one call per 30-day window; only `source: garmin` rows |
| Sleep | `GET /sleep-service/sleep/dailySleepSummariesByDate?startDate&endDate` | max 31 days; days without sleep are skipped |
| HRV | `GET /hrv-service/hrv/daily/{from}/{to}` | |
| Intraday Body Battery | `GET /wellness-service/wellness/bodyBattery/reports/daily?startDate&endDate` | max 31 days |
| Intraday heart rate | `GET /wellness-service/wellness/dailyHeartRate?date` | one call per day, **only the last 7 days** |
| Activities | `GET /activitylist-service/activities/search/activities?startDate&endDate&start&limit` | paged (50) |
| Activity detail | `GET /activity-service/activity/{id}` | lap aggregates from `splitSummaries` |

Known limitations of the Personal API (as of the spec):

- **No GPS track or per-second samples as JSON.** Only the original FIT file is downloadable
  (`/download-service/files/activity/{id}`); parsing it would need a FIT decoder and is not implemented. Activity
  detail pages therefore show laps/splits but no route map or series charts for Garmin-imported activities.
- **No intraday stress series** (only daily averages and proportions), so the stress timeline is empty.
- **No daily VO2max or training-readiness endpoint.** VO2max is taken from the day's latest activity that reports one.
- Heart-rate zone times per activity come from `hrTimeInZone_1…5` on the activity summary.

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
- What is stored is the long-lived API key; access tokens are never persisted.
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


## Checklist for the first live run

1. `supabase secrets set GARMIN_MODE=live GARMIN_API_BASE_URL=https://personal.connectapi.garmin.com`, then
   `supabase functions deploy garmin-connect garmin-sync garmin-disconnect`.
2. Delete previously simulated rows (see README) and reconnect with the API key in Settings.
3. Run the historical import; check `sync_runs` and `raw_payloads` for the real response shapes.
4. Confirm rate limits and window sizes; tune `WINDOW_DAYS` in `client.ts` and the 20 s budget in `sync.ts`.
