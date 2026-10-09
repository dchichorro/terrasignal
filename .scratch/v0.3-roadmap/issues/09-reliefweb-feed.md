# 09 ReliefWeb feed + GLIDE dedupe

Status: ready-for-agent
Type: task
Needs: pre-approved ReliefWeb appname (human registration) for live verification

## Why
ReliefWeb adds humanitarian severity and GLIDE numbers, which are cross-feed
dedupe keys (`docs/feed-research.md` §1.5).

## Scope
- `src/sources/reliefweb.mjs` reads `api.reliefweb.int/v2/disasters` with
  `status=current|alert`. `appname` comes from `RELIEFWEB_APPNAME`; without it,
  the source is `disabled`.
- Geography is country-level. Map to a country centroid (a small bundled
  ISO3 → centroid table in `src/core/geo.mjs`), and mark these events
  `geoPrecision: 'country'`. Coarse events are used to enrich and dedupe, not
  scored as stand-alone leads unless nothing else matches.
- GLIDE: carry `glide` on events from every source that has it (GDACS exposes
  it; check CEMS), and make `isSameEvent` in `merge.mjs` match on GLIDE before
  falling back to distance and time.
- Respect the quotas: 1 call per build, using the disk cache's TTL.

## Acceptance
- There are fixture-based tests for the parser and for GLIDE-first merging.
- No coarse event appears as a top lead by itself in the fixture radar.
