# 01 Snapshot history store

Status: ready-for-agent
Type: task

## Why
Each hourly run of `radar-data.yml` overwrites `public/data/radar-*.json`. With
no history there is no backtest, no trend chart, no "time to first free pass"
metric, and no record of which leads the radar flagged and when.

## Scope
- On each build, `scripts/build-static.mjs` appends one compact record per lead
  to `history/YYYY-MM-DD.ndjson` (one file per UTC day). Each record is
  `{ts, region, days, id, source, catId, lat, lng, demand, supply, opportunity,
  cls, gapReason, product, dealEUR}`, deduped on `(day, region, id, cls)`, so
  unchanged leads don't add a line every hour.
- `radar-data.yml` commits `history/` together with `public/data/`.
- `src/core/history.mjs` is isomorphic. It holds pure helpers to parse NDJSON
  and compute, per lead: firstSeen, lastSeen, peak opportunity, and class
  transitions (e.g. GAP → READY = the time until free data closed the gap).
- CLI: `npm run history -- --since=2026-10-01` prints the leads first seen in the
  window, with their class transitions.

## Acceptance
- Offline tests cover the dedupe, the parser, and the transition computation.
- Running the build twice with the same data adds no lines.
- The isomorphic test still passes (no `node:` imports in `src/core`).
- The README "Deployment" section mentions `history/`.

## Out of scope
A database. Stay with zero runtime deps; NDJSON in git is enough at this volume
(~hundreds of lines/day). Revisit if a day file passes ~1 MB.
