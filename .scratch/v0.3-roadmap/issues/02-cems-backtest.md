# 02 CEMS backtest harness

Status: ready-for-agent
Type: research

## Why
The pitch needs a number: "the radar flagged X% of EU emergency activations as
gaps/high-opportunity N hours before the activation". Copernicus EMS has more
than 1,000 historical activations, which gives a ready-made ground-truth set of
confirmed, funded imagery demand.

## Scope
- `scripts/backtest.mjs`:
  1. Fetch historical CEMS activations (the CEMS Rapid Mapping API that
     `src/sources/cems.mjs` already uses, without the open-only filter), and
     cache them to `.cache/`.
  2. For each activation, find the matching GDACS/EONET/USGS event that existed
     *before* the activation time (GDACS has an event-search API with date
     ranges; use `gdacsId` when CEMS provides it).
  3. Re-score that event "as of" T−24h and T−6h: a `nowMs` override, with STAC
     queries bounded by `datetime=../T` so later scenes don't leak in.
  4. Output a `docs/backtest.md` report: recall at TASKING GAP or PARTIAL, the
     opportunity-rank percentile against all events open at that time, the lead
     time distribution, and the misses (with their reason).
- `scoreEvent` / `buildRadar` already take `nowMs`. Add a STAC `datetime` upper
  bound to `src/core/stac.mjs` (default unchanged).

## Acceptance
- `npm run backtest -- --from=2024-01-01 --limit=200` completes and writes the report.
- There is a unit test for the "as-of" STAC bound (no scene after T is used).
- The report states its method and limitations honestly: survivorship, CEMS's
  EU bias, and that CEMS activations aren't the same as commercial orders.

## Notes
Be polite to the upstream APIs: use the existing `pool()` concurrency limiter
and the disk cache. A second run should mostly hit the cache.
