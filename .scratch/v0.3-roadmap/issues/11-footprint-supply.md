# 11 Footprint-polygon supply

Status: ready-for-agent
Type: task

## Why
Supply is measured at the event point ± a radius. For large floods, cyclones and
fires, that misjudges both coverage and deal size. GDACS and CEMS (and EFFIS,
ticket 10) publish affected-area polygons.

## Scope
- Sources attach `event.footprint` (GeoJSON Polygon/MultiPolygon, simplified to
  at most ~200 vertices) when the upstream provides one: GDACS `geometry` per
  event, the CEMS AOI.
- `src/core/stac.mjs`: query with `intersects` (the footprint) instead of a
  bbox when there is a footprint.
- `src/core/score.mjs`: a supply coverage fraction, meaning the share of the
  footprint covered by fresh, low-cloud scenes. Approximate it with a grid
  sample (e.g. 64 points inside the polygon tested against scene footprints).
  Keep it pure and isomorphic.
- `src/core/value.mjs`: AOI km² from the footprint area (spherical polygon area)
  when there is one, otherwise the current radius default. Leads show
  `aoiSource: 'footprint' | 'radius'`.
- The dashboard draws footprints when they exist.

## Acceptance
- Unit tests cover polygon area (against a known value), the grid coverage
  fraction (half-covered square ≈ 0.5), and the fallback to radius.
- The existing tests pass, and events without footprints are unchanged.
- Note in ADR 0004 why grid sampling rather than polygon clipping (zero deps,
  isomorphic).
