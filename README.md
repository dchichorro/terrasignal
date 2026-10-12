# TerraSignal: the lead radar for Earth-observation sales

**Find the satellite-imagery deals free data can't close.**

Copernicus gives away petabytes of imagery, and the EO market makes its money *around*
that free supply: tasking where free data can't deliver, and analytics where it can.
TerraSignal watches live disaster demand and free Sentinel supply on one screen, then
turns the gap into **ranked, priced leads** for tasking and analytics sales teams.

- **Live site:** https://dchichorro.github.io/terrasignal/ (landing) · [`radar.html`](https://dchichorro.github.io/terrasignal/radar.html) (dashboard)
- **Product brief:** [`docs/product.md`](docs/product.md) covers customer, positioning, pricing and roadmap
- **Domain glossary:** [`CONTEXT.md`](CONTEXT.md) · **Decisions:** [`docs/adr/`](docs/adr/)

## What it does

| Step | Inputs | Output |
|---|---|---|
| **Demand** | Copernicus EMS activations, GDACS (EC JRC/UN), USGS earthquakes, NASA EONET | merged, de-duplicated events with a demand score `D` |
| **Supply** | the real Sentinel-2 L2A optical + Sentinel-1 GRD radar catalogues (Element 84 STAC), live Sentinel orbits | free coverage `S` (freshness × cloud, radar-blended per hazard), next free pass |
| **Lead** | a transparent price book | recommended product, AOI area, indicative deal value, sales brief |

Each event's demand splits three ways, and the split is unit-tested:

    D = coverage gap  D·(1−S)        free missions have not looked (well)     → tasking
      + VHR gap       D·S·v          looked, but the need is sub-metre        → VHR tasking
      + serviceable   D·S·(1−v)      deliverable today from free data         → analytics

`v` is the hazard's very-high-resolution share: free 10 m pixels can't grade building
damage, however fresh they are. Classification (⛔ **TASKING GAP** / ◑ **PARTIAL** /
✔ **COPERNICUS-READY**) stays on coverage `S`, because it answers "can free data see it at all?".

## Product surface

- **Live radar**: ranked leads with deal value and recommended product, filters (gap / partial / ready / CEMS),
  Sentinel footprints and thumbnails, live constellation, "next Sentinel-2 look" ETA, and feed-health indicators.
- **Score any area**: drop a pin and set a radius to get a live S1+S2 supply score. This works on the static site
  too, because the scoring core runs in the browser against the CORS-open STAC.
- **Exports**: CSV (CRM), GeoJSON (GIS), Atom feed (Slack / Teams / RSS), and a one-click sales brief per lead.
- **Deep links**: region, window, filter, selected lead and pin are all kept in the URL, so you can share exactly what you see.
- **API**: `/api/radar`, `/api/aoi`, `/api/leads.csv`, `/api/leads.geojson`, `/feed.xml`, `/api/health`,
  `/api/openapi.json`.

## Quick start (zero runtime dependencies, Node ≥ 20)

```bash
npm run radar -- --region=global --days=30   # terminal lead report
npm start                                    # landing + radar → http://localhost:4660
npm test                                     # 40 offline unit/integration tests
npm run build:static                         # snapshots + exports for the static site
npm run video                                # record the product demo (needs playwright-core's browser)
```

## Architecture

    src/core/        ISOMORPHIC: runs in Node and the browser, no node: imports (test-enforced)
      score.mjs      demand / supply / SAR blend / VHR split / classification (pure)
      value.mjs      price book, product recommendation, deal sizing, pipeline totals
      merge.mjs      cross-feed fusion and de-duplication (source precedence CEMS > GDACS > USGS > EONET)
      aoi.mjs        custom-AOI scoring with injectable catalogue fetchers
      export.mjs     CSV / GeoJSON / Atom / sales brief
      stac.mjs       Sentinel-1/2 catalogue client · http.mjs fetch with timeout + retry
    src/sources/     demand-feed adapters, one module each (id, label, fetchEvents) + registry
    src/lib/cache.mjs disk cache: TTL, stale-on-error, single-flight
    src/radar.mjs    orchestration, dependency-injected (sources, supply, cache, clock)
    src/app.mjs      HTTP handler factory: routing, validation (400s), exports, static, security headers
    src/server.mjs   entrypoint · src/cli.mjs terminal report · src/openapi.mjs API description
    public/          landing (index.html), dashboard (radar.html, js/*.mjs ES modules), static data/
    scripts/         build-static.mjs (snapshots, exports, core bundle) · demo-video.mjs

The browser imports the same `src/core` (served at `/core/` live, or copied to
`public/core/` for Pages). That gives one scoring model and one export format whether
the radar runs on the server, in the browser, or in CI.

**Resilience:** every feed is isolated. A dead source is reported in `radar.feeds` and
shown in the UI, and the radar is built from whatever remains. Catalogue calls are
disk-cached with stale-on-error, and concurrent identical calls share one upstream request.

## Deployment (GitHub Pages)

- `radar-data.yml` runs hourly: it builds snapshots and exports into `public/data/` and commits them
  only when they materially changed.
- `pages.yml` deploys on push **and after each radar-data run** (`workflow_run`). Bot pushes made
  with `GITHUB_TOKEN` never trigger `push` workflows, so before this fix the site stopped
  updating on 2026-09-20.
- `ci.yml` runs the test suite on Node 20 and 22.

## Honest limitations

- Price-book values are **illustrative placeholders**. Calibrate `src/core/value.mjs` against a real price list.
- `VHR_NEED`, `SAR_UTILITY` and the demand priors are reasoned heuristics, open for calibration against real order books.
- EONET skews to the US; GDACS and CEMS carry most non-US demand. See [`docs/feed-research.md`](docs/feed-research.md)
  for the next feeds (FIRMS, ReliefWeb, EFFIS…).
- Supply is measured at the event point ± AOI margin, not the full footprint polygon.

Data attribution: Copernicus EMS, GDACS (EC JRC / UN), USGS, NASA EONET (GSFC), Copernicus
Sentinel-1/2 (ESA) via Element 84 Earth Search, CelesTrak. TerraSignal is a market-intelligence
tool, not an emergency-response system.
