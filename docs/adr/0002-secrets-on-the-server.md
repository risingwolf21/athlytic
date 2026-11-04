# ADR 0002 – Secrets only on the server

**Status**: accepted

**Context**: A PWA ships all its code to the user; anything in the bundle is public.

**Decision**: Provider tokens are posted once to an edge function, encrypted with AES-256-GCM
(`CREDENTIAL_ENCRYPTION_KEY`) and stored in `provider_credentials`, which has RLS enabled and no client privileges.
Edge functions verify the user's JWT themselves (`verify_jwt = false` in `config.toml`) so they can return structured
errors, and act with the service role.

**Consequences**: The browser can never read tokens or raw payloads. The encryption key must be set as a function
secret; losing it requires users to reconnect.
