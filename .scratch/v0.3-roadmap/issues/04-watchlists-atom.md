# 04 Watchlists + per-watchlist Atom feed

Status: ready-for-agent
Type: task

## Why
"Tell me when something happens near my assets" is the first feature worth
paying for: ports, insured portfolios, pipelines. This ticket builds it without
accounts: the watchlist is encoded in a URL, so alerts come through any RSS
reader, Slack, or Teams.

## Scope
- Watchlist = a list of `{name, lat, lng, radiusKm}` (max 50), plus an optional
  class filter. It is encoded compactly in a URL parameter (`w=` base64url of
  JSON, length-capped).
- Dashboard: "Add to watchlist" from the AOI pin, a watchlist panel, and
  highlighting of leads that intersect a watched area. Stored in `localStorage`.
  The "Copy feed URL" button gives `/feed.xml?w=...`.
- Server: `/feed.xml` accepts `w=` (and `filter=gap|partial|ready|cems`) and
  returns only the leads that intersect the watched areas, as an Atom entry per
  (lead, watched area) with a stable id. `src/core/export.mjs#toAtom` gets the
  filtering as a pure helper (`leadsInWatchlist`).
- Static site: document that per-watchlist feeds need the live API. The static
  `feed-<region>.xml` stays as it is.
- Add it to `src/openapi.mjs`.

## Acceptance
- There are unit tests for encode/decode (including malformed and oversized →
  400), intersection (haversine with the lead's AOI radius), and Atom id
  stability.
- The `feed.xml?w=` output validates as Atom.
- Watchlist round-trips through a deep link.

## Out of scope
Email/push delivery and server-stored watchlists. Both need accounts.
