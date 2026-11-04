# ADR 0006 – Leaflet and OpenStreetMap for routes

**Status**: accepted

**Decision**: Routes use Leaflet with OSM tiles, lazy-loaded on the activity detail page. Tiles are cached only as
viewed (OSM policy forbids bulk prefetching). Leaflet was chosen over a larger WebGL map library for bundle size.

**Consequences**: One extra dependency, free tiles with attribution; no offline map packs.
