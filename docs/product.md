# TerraSignal: product brief

## The problem

The Earth-observation market has a strange shape. The largest supplier, Copernicus,
gives its data away. Commercial players (VHR optical, commercial SAR, value-added
analytics) earn their revenue in the gaps around that free supply. Yet nobody watches
**demand** (where imagery is needed now) and **free supply** (what the Sentinels have
actually captured) on the same screen. Sales teams learn about a tasking opportunity
when the RFP lands, which is usually days after the event and after a competitor has called.

## The product

A live lead radar. Every open disaster event is scored on:

1. **Demand**: hazard type, official alert level, magnitude, recency, and whether the EU
   has activated Copernicus EMS (confirmed, funded demand).
2. **Free supply**: real Sentinel-2 optical and Sentinel-1 radar catalogue coverage
   (freshness, cloud, revisit), plus the next free pass from live orbits.
3. **The gap**: demand split into a *coverage gap* (free missions haven't seen it), a
   *VHR gap* (seen at 10 m, but the buyer needs sub-metre detail) and *free-serviceable* work.

Each event becomes a lead with a recommended product, an AOI, an indicative deal value
and a copy-ready sales brief.

## Ideal customer profiles

| ICP | Job to be done | Hook in the product |
|---|---|---|
| **Imagery resellers / tasking sales** (VHR optical, commercial SAR) | be first to the buyer when free data can't serve | ranked tasking leads with € value, Atom/Slack alerts, CRM CSV |
| **Value-added analytics firms** | find work deliverable from free data at zero acquisition cost | "Copernicus-ready" filter, S1/S2 analytics recommendations |
| **Insurers / parametric risk** | know whether imagery will exist over a site after an event | score-any-area pin, next-pass ETA |
| **Emergency-mapping providers** (CEMS contractors, Charter, NGOs) | plan commercial and contributing-mission tasking | CEMS activations next to the free-coverage picture |

Primary beachhead: **tasking sales teams at EO resellers in Europe**. They have
the clearest money-per-lead, they're used to buying market intelligence, and the
Copernicus-vs-commercial framing is native to them.

## Positioning

> For EO sales teams who need to know where satellite imagery will be bought next,
> TerraSignal is a demand radar that shows, live and priced, where free Copernicus
> data falls short. Unlike news monitoring or disaster dashboards, it measures the
> *supply side* from the real catalogues, so every lead comes with a reason free
> data can't close it.

## Pricing (early-access proposal)

| Plan | Price | For | Includes |
|---|---|---|---|
| Explorer | free | top of funnel, credibility | public radar, AOI pin, CSV/GeoJSON, public feed |
| Pro | €490 / month / team | a reseller sales team | own price book, AOI watchlists + alerts, Slack/Teams/email, API 10k/mo |
| Enterprise | custom | large resellers, insurers | CRM sync, private feeds/catalogues, model calibration on order book, SLA, on-prem |

Rationale: one closed VHR tasking order (low five figures in € list value) pays for
years of Pro, so the value case is a single lead. The free tier is the marketing.

## What was built in this iteration (v0.2)

- **Commercial layer**: product recommendation, AOI sizing, indicative deal value and
  weighted pipeline. One price-book file to calibrate.
- **Better demand**: Copernicus EMS activations (confirmed tasking demand) and USGS
  earthquakes, fused with GDACS and EONET with source precedence.
- **Better supply**: Sentinel-1 SAR coverage blended per hazard (floods and quakes yes,
  burn severity less so). Cloudy demand no longer counts as an automatic gap when free radar has it.
- **Honest gap model**: a VHR share per hazard, so covered earthquakes still surface the
  building-damage opportunity that free 10 m data can't serve.
- **Sales workflow**: CSV/GeoJSON/Atom exports, sales brief, deep links, filters, landing
  page with live numbers and pricing.
- **Works anywhere**: AOI scoring runs in the browser on the static site.

## Roadmap

Tracked as GitHub issues (label `v0.3`). See [`roadmap.md`](roadmap.md), which also lists the human-only items.

**Next (validate)**
1. Calibrate the price book and `VHR_NEED` with 3–5 reseller sales leads. Track whether radar leads precede RFPs.
2. Saved AOI watchlists with alerting (needs accounts, so it's the first paid feature).
3. NASA FIRMS (sub-daily fires) and ReliefWeb (humanitarian severity, GLIDE dedupe). See `feed-research.md`.

**Later (scale)**
4. Footprint-level supply (GDACS/CEMS polygons) instead of point ± margin.
5. Commercial catalogue integration (what competitors already captured) for true market-gap sizing.
6. CRM connectors (HubSpot/Salesforce) and a hosted multi-tenant API.

## Metrics that matter

- Lead → conversation rate at design-partner resellers (target ≥ 10 %)
- Median lead time between the radar flagging a lead and the customer's first RFP (target: positive, in days)
- Weekly active sales users. Atom-feed subscribers as a free-tier proxy.

## Risks

- **Model credibility**: the heuristics need calibration, so they're shown transparently (ⓘ in the UI) and not as a black box.
- **Data licensing**: all current feeds are open, and conflict feeds (ACLED) are excluded until licensing is resolved (`feed-research.md`).
- **Sensitivity**: CEMS `sensitive` activations are never shown. This is market intelligence, not a response system.
