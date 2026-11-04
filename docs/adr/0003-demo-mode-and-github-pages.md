# ADR 0003 – Demo mode for static hosting

**Status**: accepted

**Context**: GitHub Pages can only host static files; a hosted Supabase project would cost money.

**Decision**: Without `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` the app runs in demo mode: the same fixtures and
normalizers as the backend run in the browser. Both modes implement one repository interface.

**Consequences**: The public site is fully explorable without a backend. A real deployment only needs the two env
variables at build time.
