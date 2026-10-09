# 10 EFFIS burnt-area feed

Status: ready-for-agent
Type: task

## Why
EFFIS (EU JRC) is keyless and authoritative for European fires. Its burnt-area
**polygons** are ready-made footprints (`docs/feed-research.md` §3.3), and the
EU is the beachhead market.

## Scope
- `src/sources/effis.mjs`: WFS `GetFeature` for recent burnt areas
  (`ms:modis.ba.poly` or the current layer name; verify it live), requesting
  GeoJSON output if the server supports it.
- Map each polygon to an event: centroid → lat/lng, area (ha) →
  `magnitudeValue`, fire date → `openedISO`, and keep the polygon on
  `event.footprint`, ready for ticket 11.
- Merge precedence: EFFIS is above EONET for EU fires.

## Acceptance
- There is a fixture-based parser test, and the merge test covers EFFIS + EONET
  for the same fire.
- The feed is verified live once and the result recorded in the PR (layer name,
  output format, typical volume).
