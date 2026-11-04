# ADR 0001 – Provider-independent data model

**Status**: accepted

**Context**: Garmin is the first source; Apple Health, Health Connect and file imports may follow.

**Decision**: Providers implement `DataProvider` and return a normalized bundle (`_shared/domain.ts`). Tables carry
`source` and `fetched_at`; the original payload is kept in `raw_payloads`. A priority table resolves conflicts and
`duplicate_of` links duplicate activities.

**Consequences**: New sources need an adapter only. Normalization can be re-run from raw data. Storage cost is higher
(raw + normalized).
