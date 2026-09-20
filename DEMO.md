# Demo script (≈5 min)

## 0. Start (one terminal)

    cd ~/terrasignal
    npm run demo          # http://localhost:4660  (warms caches ~40 s on first boot)

In a second terminal, the raw view for cut-and-paste:

    npm run radar -- --region=global --days=30

## 1. The pitch (30 s)

Copernicus gives away petabytes of imagery. The ESA market's money is made *around*
that free supply: tasking when free data can't deliver, analytics when it can.
Nobody watches demand and supply together on one screen. TerraSignal does.

## 2. Global view (2 min)

1. Open http://localhost:4660 → top right: toggle **Global**, `last 30d`.
2. Header KPIs:
   - **"new S2 scenes / 24 h"** — live pulse of free supply (~12.6k global, ~1.5k Europe).
   - **"demand not met by free imagery %"** — the tasking signal, computed from real
     catalog coverage, not vibes.
3. Click a **red ⛔ TASKING-GAP** marker (e.g. a fresh fire with no recent passes):
   popup says *"no Sentinel-2 overpass in event window"* — that's a lead: this is where
   Pleiades Neo / SAR tasking earns. Footprint outlines (dashed blue) show where
   Copernicus *has* looked.
4. Click a **green ✔ COPERNICUS-READY** event: latest real Sentinel-2 thumbnail
   (public S3 `preview.jpg`), observed revisit cadence, cloud %. The pitch here is
   analytics-on-free-data — deliverable *today*, zero acquisition cost.
5. Sidebar meters: red segment = gap, green = serviceable-now; their sum = demand.
6. The small glowing dots are the **live Copernicus constellation** (Sentinel TLEs
   propagated in-browser). Open a ⛔ event: the popup's *next Sentinel-2 look* row is the
   closer — "none in 4 d" means free eyes physically cannot see this demand. That single
   line *is* the tasking pitch.

## 3. Terminal view (1 min)

Switch to the CLI: bar chart per event, `GAP`/`NOW` split, classifications, cadences.
Good for: ops people, email digests, and showing the model without a browser.

## 4. Honest limitations slide (1 min)

- EONET skews US; GDACS (EC JRC) carries the rest — swap in ERCC/EMS for EU depth.
- Supply = optical S2 only: cloud is penalised though SAR could serve it; next step is
  Sentinel-1 in the same STAC.
- Demand prior is category × alert-level × age × magnitude — a starting heuristic,
  open for calibration against real order books.

## 5. Close

One idea to leave them with: *the gap between what disasters ask for and what
Copernicus delivers is the market. This radar measures that gap, live.*
