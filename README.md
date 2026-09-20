# TerraSignal — EO Demand Radar

**Who needs satellite data right now — and can free Copernicus imagery actually serve them?**

TerraSignal turns the ESA space market's core economics into a live map. It fuses two
public demand feeds — **GDACS** (the European Commission/UN disaster alert system) and
**NASA EONET** (open natural events) — with the real **Sentinel-2 L2A** catalog (Copernicus
data, served open via Element 84's STAC API), and scores every event on one axis:

| Classification | Meaning | Business read |
|---|---|---|
| ⛔ **TASKING GAP** | high demand, no fresh & clear free imagery | commercial VHR tasking lead (Pleiades Neo, IDEa, Spire, ICEYE…) |
| ◑ **PARTIAL** | stale or cloudy free data | up-sell: fusion, SAR complement, priority revisit |
| ✔ **COPERNICUS-READY** | fresh, mostly clear S2 passes on scene | serviceable today — value-added analytics on free data |

The headline KPI — **unmet demand share** — is a proxy for the addressable near-term
tasking market, and the **24 h ingest counter** is the pulse of free-supply flooding
Europe (≈1.5k new scenes/day over the continent).

## Score model

For each event, with free-imagery supply `S ∈ [0,1]` measured from actual catalog data
(freshness × cloud, Sentinel-2 revisit ≈ 5 d) and demand `D ∈ [0,1]` from alert/category
prior, age decay and reported magnitude:

- `opportunity  = 100 · D · (1 − S)` → tasking-gap signal
- `serviceable  = 100 · D · S` → revenue achievable off free data today
- `opportunity + serviceable = demand` — the split is the insight, unit-tested.

## Quick start (zero dependencies, Node ≥ 20)

```bash
npm run radar -- --region=global --days=30   # terminal radar report
npm run demo                                 # dashboard → http://localhost:4660
npm test                                     # score model unit tests
```

## Layout

    src/score.mjs   pure demand/supply scoring model (tested)
    src/gdacs.mjs   GDACS EC/UN alert RSS → unified events
    src/eonet.mjs   NASA EONET open events → unified events
    src/stac.mjs    Sentinel-2 L2A catalog queries (Element 84 STAC, keyless)
    src/radar.mjs   orchestration: merge, dedupe, per-event supply scan, KPIs
    src/server.mjs  static host + /api/radar + /api/pulse (ISS live), cache-warm on boot
    src/cli.mjs     ANSI report
    public/         Leaflet dashboard (dark map, ranked sidebar, footprints, thumbnails)

Data is disk-cached (`.cache/`) with stale-on-error, so demos survive network blips.

## Roadmap / honest limitations

- EONET is currently US-biased; GDACS carries the non-US demand — a EU civil-protection
  (ERCC) feed or EMS activation API would deepen it.
- Supply is optical-only; a SAR complement (Sentinel-1 via the same STAC) would stop
  penalising cloudy demand that commercial SAR can actually serve.
- `gdx_score`, affected-population fields and ERCC news could sharpen the demand prior;
  a Pleiades Neo / OneAtlas price book would convert gap scores into € of market.

Data attribution: NASA EONET (GSFC), GDACS (EC JRC / UN), Copernicus Sentinel-2
processed by ESA, catalog via Element 84's public STAC. This is a demo tool, not a
response system.
