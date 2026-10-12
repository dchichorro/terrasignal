# TerraSignal: domain glossary

Read this first. These terms are used consistently in code, UI and docs.

| Term | Meaning | Where |
|---|---|---|
| **Event** | one real-world hazard occurrence after cross-feed merge (a GDACS flood, a CEMS activation and an EONET entry about the same flood are one event) | `src/core/merge.mjs` |
| **Source / feed** | a demand-side adapter (`CEMS`, `GDACS`, `USGS`, `EONET`) exporting `id`, `label`, `fetchEvents` | `src/sources/` |
| **Activation** | a Copernicus EMS rapid-mapping activation: the EU has commissioned satellite mapping, i.e. confirmed funded demand | `cems.mjs`, `event.activation` |
| **Demand `D`** | 0–1 (shown ×100): hazard/alert prior × recency (20 d half-life) × magnitude boost × activation boost | `demandScore` |
| **Pass** | one acquisition day of a mission over the point (adjacent tiles on the same day count once) | `supplyStats` |
| **Optical supply** | Sentinel-2 freshness (7 d scale) × clear-sky share | `supplyStats().supply` → `opticalSupply` |
| **SAR supply** | Sentinel-1 freshness only (cloud-blind) | `sarStats` |
| **SAR utility `u`** | per hazard, how far a radar look substitutes for optical | `SAR_UTILITY` |
| **Free supply `S`** | `1 − (1 − S_opt)(1 − u·S_sar)` | `combinedSupply`, `event.supply` |
| **VHR need `v`** | per hazard, the share of need only sub-metre imagery can meet | `VHR_NEED` |
| **Coverage gap** | `D·(1−S)`: free missions have not looked (well) | `event.coverageGap` |
| **VHR gap** | `D·S·v`: looked, but too coarse | `event.resolutionGap` |
| **Serviceable** | `D·S·(1−v)`: deliverable now from free data | `event.serviceable` |
| **Opportunity / commercial** | coverage gap + VHR gap: the paid-imagery signal | `event.opportunity` |
| **Classification** | on `S` only: `TASKING GAP` < 0.35 ≤ `PARTIAL` < 0.65 ≤ `COPERNICUS-READY` | `classify` |
| **Gap reason** | why optical falls short: `no-pass`, `stale`, `cloud` | `gapReason` |
| **Lead** | an event plus commercial fields: AOI radius/area, recommendation, `dealEUR`, `weightedEUR` | `toLead` |
| **Motion** | `tasking` (sell new acquisitions) or `analytics` (sell work on free data) | `recommendation.motion` |
| **Price book** | the single table every € figure derives from. Values are illustrative | `PRICEBOOK` |
| **Weighted pipeline** | Σ deal × matching score share (opportunity for tasking, serviceable for analytics) | `pipelineTotals` |
| **AOI** | area of interest: hazard-default radius for events, user-set for pins | `DEFAULT_RADIUS_KM`, `aoi.mjs` |
| **Snapshot** | a precomputed radar JSON for the static site (`public/data/`) | `build-static.mjs` |

Invariant: `src/core/` is isomorphic (browser + Node). `test/isomorphic.test.mjs` enforces it.
