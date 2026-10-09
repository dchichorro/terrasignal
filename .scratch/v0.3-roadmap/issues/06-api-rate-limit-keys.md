# 06 API rate limiting + API keys

Status: ready-for-agent
Type: task

## Why
Every `/api/aoi` request triggers live STAC queries, and the server now binds
`0.0.0.0`. Before any public exposure, an abusive client must not be able to
burn upstream goodwill or the box.

## Scope
- `src/lib/ratelimit.mjs`: an in-memory token bucket keyed by API key, or by
  client IP when there is no key. `X-Forwarded-For` is honoured only when
  `TERRASIGNAL_TRUST_PROXY=1`.
- Defaults: `/api/aoi` 30/min anonymous, `/api/*` 120/min. Over the limit → 429
  with `Retry-After` and `RateLimit-*` headers.
- Optional API keys: `TERRASIGNAL_API_KEYS` (comma-separated, or a path to a JSON
  file `{key: {name, aoiPerMin}}`), read from the `Authorization: Bearer`
  header. With `TERRASIGNAL_REQUIRE_KEY=1`, `/api/aoi` returns 401 without one.
  Read-only snapshot endpoints stay open.
- Wire it through `createHandler` deps, so tests inject a fake clock.
- Document it in the README and OpenAPI (security scheme + 429).

## Acceptance
- Unit tests with an injected clock cover bucket refill, the per-key override,
  the 429 headers, the 401 when a key is required, and that the proxy header is
  ignored unless trusted.
- No behaviour change for the static site.
