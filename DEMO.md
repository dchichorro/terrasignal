# Demo script (≈5 min)

A recorded walkthrough is generated with `npm run video` (needs `npm start` running;
writes `demo/terrasignal-demo.webm`).

## 0. Start

    cd ~/terrasignal
    npm start             # http://localhost:4660  (warms caches ~40 s on first boot)

Second terminal, for the raw view: `npm run radar -- --region=global --days=30`

## 1. The pitch (30 s), on the landing page

Copernicus gives away petabytes of imagery. The EO market's money is made *around* that
free supply: tasking where free data can't deliver, and analytics where it can. Nobody
watches demand and supply together. TerraSignal does, and puts a price on the gap.
Point at the live card: weighted pipeline, the share of demand that needs paid imagery, and the top leads.

## 2. Global radar (2 min)

1. **Open the live radar** → Global. Top KPI: *indicative weighted pipeline*. Click ⓘ to show the price
   book. It's one transparent table, illustrative until calibrated.
2. Click a **⛔ TASKING GAP** earthquake: no Sentinel-2 pass since the event, so the lead is
   **VHR optical tasking** with a € value. *Next Sentinel-2 look* says when free eyes return.
3. Click a **tropical cyclone**: under cloud, so the recommendation switches to **commercial SAR**.
4. Click a **✔ ready** earthquake: free 10 m data saw it, but the pink **VHR gap** on the meter is
   building-damage grading, which free data can never do. Recommendation: VHR damage assessment.

## 3. Europe (1 min)

1. Switch to **Europe**, filter **CEMS**: Copernicus EMS activations (dashed rings) mean the EU is
   already buying imagery there. That's confirmed demand.
2. Click a cloudy **flood**: Sentinel-1 radar passed recently, so it's **Sentinel-1 SAR analytics on
   free data**. A cloudy flood is not a gap.

## 4. Sales workflow (1 min)

- **Copy sales brief** on any lead: a paragraph ready for email or CRM.
- **Score an area**: drop a pin and drag the radius to re-score live (on the static site this runs in the browser).
- **Export leads**: CSV (CRM), GeoJSON (GIS), Atom feed (Slack/Teams). **🔗** copies a deep link to this exact view.

## 5. Honest limitations (30 s)

- The price book, `VHR_NEED`, `SAR_UTILITY` and the demand priors are heuristics to calibrate with design partners.
- EONET skews US; next feeds are FIRMS and ReliefWeb (`docs/feed-research.md`).
- Supply is measured at the event point ± AOI, not the full footprint polygon.

## 6. Close

*The gap between what disasters ask for and what Copernicus delivers is the market.
This radar measures that gap live, and prices it.*
