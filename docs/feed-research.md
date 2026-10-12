# TerraSignal EO Demand Radar — Live Event/Demand Feed Research

Date: 2026-09-20. Scope: PRIMARY SOURCES ONLY (official docs/API pages).
Every feed below carries ≥1 primary-source URL. URLs marked **[fetched]**
were retrieved and read during this research; URLs marked **[search-verified]**
were confirmed via official-domain search results (page content verified in
snippet, full page not fetched — re-fetch before building on them).

TerraSignal unified event shape (from `src/score.mjs` + radar pipeline):

```js
{id, title, place, catId, prior, openedISO, latestISO, lng, lat,
 magnitudeValue, magnitudeUnit, alertLevel, src, sources}
```

Score model inputs that matter: `catId` (+`prior` weight via
`CATEGORY_WEIGHT`), `openedISO` (recency decay, 20-day half-life),
`lat/lng` (STAC supply lookup), `magnitudeValue` (log boost).
Feeds that natively supply **point + time + severity + category** score
High fit; polygon/footprint feeds score higher on supply-side value but need
centroid extraction.

Current sources (baseline, not re-researched): GDACS RSS
(`https://www.gdacs.org/xml/rss.xml`), NASA EONET API v3.

## Summary table

| Feed | Purpose group | Keyless? | Cadence | License / redistribution | Fit |
|---|---|---|---|---|---|
| USGS Earthquake GeoJSON | 1 natural-disaster | Yes | ~1 min (feeds), query on demand | US public domain (verify at usgs.gov/legal) | High |
| GDACS extended APIs (geteventlist/geteventdata, per-hazard RSS, KML) | 1 natural-disaster | Yes | ~6 min (feeds); API cached per update | Free; EU/JRC terms on site | High |
| NASA FIRMS fire API | 1 natural-disaster | Free MAP_KEY required | NRT ~3h / URT <60s (US/Canada) | Free; NASA EOSDIS open use | High |
| Copernicus EMS Mapping API | 1 natural-disaster (+3 infra) | Yes | Per activation (event-driven) | Copernicus open data (acknowledge source) | High |
| ReliefWeb API v2 (disasters+reports) | 1 natural-disaster / 2 humanitarian | Appname (pre-approved since 2025-11-01); no key | Real-time on publish | Partner content: respect source copyright; quotas 1000 calls/day, 1000 records/call | High |
| NOAA NHC GIS (tracks, cone, wind, surge) | 1 natural-disaster | Yes | Per advisory (~6h in season) | US public domain (NOAA) | High |
| Smithsonian GVP Weekly Report | 1 natural-disaster | Yes (HTML, no API) | Weekly (Thu 2300 UTC) | Educational use; cite GVP | Med |
| Dartmouth Flood Observatory archive | 1 natural-disaster | Yes (bulk download) | Static v0.9.0 thru Dec 2023; active archive ongoing | CC0 | Med |
| GloFAS forecasts (EWDS/MARS/WMS-T) | 1 natural-disaster | Registration (free) | Daily | Open, GloFAS Terms of Service | Med |
| UN OCHA HDX (CKAN + HAPI) | 2 humanitarian | CKAN read: yes; HAPI: app_identifier; write: token | Dataset-dependent (daily–ad hoc) | Per-dataset licenses (mostly CC BY) | Med |
| ACLED API | 2 conflict | No (myACLED account + OAuth) | Weekly (Mon/Tue) | Non-commercial transformative-only; corporate/public-sector licence for commercial use — **redistribution restricted** | Med |
| UCDP API (GED + yearly) | 2 conflict | Token via email request (free) | Annual + monthly/quarterly candidates | Free for research; 5000 req/day | Med |
| UNOSAT Emergency Mapping | 2 conflict/humanitarian | N/A (no public event API; web products) | Per activation (24–72h) | UN; maps shareable with attribution | Low (no API) |
| GDELT 2.0 (events, GKG, DOC API) | 2 media-demand proxy | Yes (raw files + BigQuery; DOC API keyless) | 15 min | Free/open | Med |
| EMSA CleanSeaNet | 3 oil spills / maritime | No (participating States only) | NRT (~20 min post-overpass) | Restricted — **no public feed** | Low (inaccessible) |
| FEWS NET Data Warehouse API | 3 agriculture/drought | Public extracts yes; restricted: token | Monthly reports; dekadal agroclim | US public; cite FEWS NET | Med |
| FAO GIEWS | 3 agriculture/drought | Yes (reports; no event API) | Monthly/quarterly | UN FAO; cite | Low |
| USDA Crop Explorer | 3 agriculture/drought | Yes (viewer; no public API) | Daily–dekadal imagery | US public domain | Low |
| Global Forest Watch Data API | 3 deforestation/fires | API key required (free signup) | Daily (GLAD-S2), weekly (GLAD-Landsat) | CC BY 4.0 (WRI) | High |
| EFFIS (WMS/WFS fire layers) | 3 deforestation/fires | Yes | Daily (active fires, burnt area) | Free with licence acknowledgement | High |
| VAAC London QVA API | 3 ash/air quality | Registration + licence (free for aviation users) | Eruption-driven | Met Office licence; redistribution limited | Med |
| CAMS (fire emissions, aerosol) | 3 ash/air quality | Free (ADS account for downloads) | Daily + forecast | Copernicus open data | Med |
| PDC DisasterAWARE | 1 natural-disaster | Unknown — **NOT verified** | — | — | Unknown |

## 1. Natural-disaster complements

### 1.1 USGS Earthquake GeoJSON API — fit: High
- Owner: U.S. Geological Survey, Earthquake Hazards Program.
- Endpoints **[fetched]**:
  - Format/fields: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php`
  - Real-time feeds: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{significant|4.5|2.5|1.0|all}_{hour|day|week|month}.geojson` (updated every minute)
  - Catalog query (FDSN): `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&...` **[search-verified]** (`https://earthquake.usgs.gov/fdsnws/event/1/`)
  - Detail per event: `…/feed/v1.0/geojson_detail.php` **[search-verified]**
- Cadence/coverage: global earthquakes, per-minute feed refresh.
- Access: keyless. No rate limit published on feed pages; catalog API asks heavy users to prefer feeds.
- Fields → unified shape: `properties.mag`→`magnitudeValue` (unit "mw"-ish via `magType`), `place`→`place`, `time`→`openedISO`, `updated`→`latestISO`, `alert` (green/yellow/orange/red)→`alertLevel`, `tsunami` flag, `sig`, `felt`/`cdi`/`mmi` severity, `geometry.coordinates [lng,lat,depth]`→`lng/lat`, `id`+`detail` URL→`id/sources`. Near-perfect fit; `catId="earthquake"`, prior 0.85.
- Effort: trivial — same GeoJSON polling pattern as EONET. Caveats: magnitude types vary (`magType`); depth ignored by scorer; dedupe vs GDACS-EQ events by time+location.

### 1.2 GDACS extended APIs (beyond the RSS baseline) — fit: High
- Owner: GDACS (UN, European Commission JRC, disaster managers).
- Endpoints:
  - Swagger/API: `https://www.gdacs.org/gdacsapi/swagger/index.html` **[search-verified]**
  - Quickstart PDF: `https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v2.pdf` **[search-verified]** — documents `…/gdacsapi/api/Events/geteventlist/SEARCH` (GeoJSON, ≤100 records/page, `pagenumber`/`pagesize`), `…/api/events/geteventdata?eventtype=FL&eventid=…`, `…/api/events/geteventlist/events4app` cache-friendly collection, bulk KML last-4-days at `https://www.gdacs.org/kml.aspx`, per-event KML via `resources.aspx?eventid=…&eventtype=TC`.
  - Per-hazard RSS **[fetched]**: `https://gdacs.org/feed_reference.aspx` — 24h/7d all-events, EQ (M≥4.5/5.5, 48h; orange/red 3mo), TC 7d/3mo, flood 7d/3mo; "updated every 6 minutes". E.g. `https://www.gdacs.org/xml/rss_24h.xml`, `…/rss_eq_48h_med.xml`, `…/rss_tc_7d.xml`, `…/rss_fl_7d.xml`.
- Access: keyless, free (JRC disclaimer/copyright footer applies).
- Fields → shape: event list carries alert score, population exposure, severity, `datetime` (opened/latest), footprint links (TC track polygons, flood extents) — footprints let TerraSignal score *area* demand and derive centroids; `alertLevel` maps directly to GDACS green/orange/red.
- Effort: low — extend existing `src/gdacs.mjs` RSS parser to per-hazard feeds + `geteventdata` enrichment. Caveat: ≤100/page pagination; poll `events4app` and diff on `datetime`.

### 1.3 NASA FIRMS fire API — fit: High
- Owner: NASA LANCE FIRMS.
- Endpoints **[fetched]**: `https://firms.modaps.eosdis.nasa.gov/api/` — services `area` (`/api/area/csv/[MAP_KEY]/[SOURCE]/[AREA_COORDINATES]/[DAY_RANGE]`), `data_availability`, `kml_fire_footprints`, `map_key`, `missing_data`. Sources include `MODIS_NRT`, `MODIS_SP`, `VIIRS_SNPP_NRT`, `VIIRS_NOAA20/21_NRT`, `LANDSAT_NRT` (US/Canada only).
- Cadence/coverage: global active-fire hotspots; NRT within ~3h, RT/URT <60 min (US/Canada); URT purged after ~6h.
- Access: free `MAP_KEY` required (signup). CSV output.
- Fields → shape: hotspot lat/lng, brightness, FRP (→`magnitudeValue`, unit "MW"), confidence, satellite/instrument, date. No event clustering — TerraSignal must cluster hotspots into fire events (grid + time window) before scoring; `catId="wildfires"`, prior 1.0 (highest weight). Complements EONET wildfire coverage with sub-daily refresh.
- Effort: medium — polling + clustering + FRP aggregation. Caveats: hotspot≠event (false positives from gas flares/industry); `country` endpoint currently unavailable per API page.

### 1.4 Copernicus EMS Mapping API — fit: High
- Owner: EU Copernicus Emergency Management Service (JRC).
- Endpoints **[fetched]**:
  - Guide: `https://mapping.emergency.copernicus.eu/about/how-to-harvest-cems-mapping-data/`
  - List: `https://mapping.emergency.copernicus.eu/activations/api/activations/` (+`/{code}/` detail; OpenAPI at `…/api/redoc/`)
  - Rapid Mapping: `https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/` and `…/public-activations/?code={code}` **[search-verified]** (via `…/about/how-to-harvest-cems-mapping-data/emergency-response-data/`)
  - Risk & Recovery: `https://riskandrecovery.emergency.copernicus.eu/api/public-activations/` **[search-verified]**
- Cadence/coverage: event-driven activations global (on request of Authorised Users); each record has `code`, `name`, `category.slug/name` (storm/flood/fire/quake…), `countries[]`, `centroid` WKT POINT(lon lat), `activationTime`/`lastUpdate`, `closed`, `n_aois`, `n_products`, AOI polygons + product download/ArcGIS links, `gdacsId` cross-link.
- Access: keyless JSON. Licence: Copernicus open data (attribute; confirm current terms at emergency.copernicus.eu).
- Fields → shape: activation = *confirmed satellite-tasking demand* (strongest demand proxy in this survey). `activationTime`→`openedISO`, centroid→`lng/lat`, category slug→`catId`, `closed=false`→active boost; AOI polygons enable footprint supply scoring; product links evidence what was already mapped (supply side!).
- Effort: low–medium. Caveats: activation time lags event onset (authorisation delay); `sensitive=true` activations restricted; counts are mapping workload, not severity — keep magnitude from GDACS/USGS.

### 1.5 ReliefWeb API v2 — fit: High
- Owner: UN OCHA ReliefWeb.
- Endpoints **[fetched]**: docs `https://apidoc.reliefweb.int/`, endpoints `https://apidoc.reliefweb.int/endpoints`, live host `https://api.reliefweb.int/v2/{reports,disasters,countries,…}`, OpenAPI `https://api.reliefweb.int/v2/swagger/api`. Disaster list with GLIDE numbers via `disasters` endpoint (`preset=external` in v1 docs).
- Cadence/coverage: real-time on editorial publish; global archive back to 1980s/1996.
- Access: no key, but `appname` required and **pre-approved appname mandatory from 2025-11-01** — register TerraSignal's appname before building. Quotas: ≤1000 records/call, ≤1000 calls/day.
- Licence: partner-owned content — respect source copyright; no guarantee of accuracy; free.
- Fields → shape: `disasters` endpoint gives disaster names, types (→`catId`), countries (→`place`, coarse), dates (`openedISO`), GLIDE (dedupe key vs GDACS). `reports` give severity narratives but no magnitudes/coordinates — geocode via `countries` + disaster profile. Best humanitarian-severity complement to physical feeds.
- Effort: low (POST JSON queries). Caveats: country-level geography only (no lat/lng); editorial lag hours–days; apply for appname early.

### 1.6 NOAA/NHC tropical cyclone GIS — fit: High
- Owner: NOAA National Hurricane Center (+ Central Pacific HC).
- Endpoint **[fetched]**: `https://www.nhc.noaa.gov/gis/` — per-storm shapefiles/KMZ: advisory forecast track + cone of uncertainty, watches/warnings, wind-field radii, preliminary best-track, arrival-time of TS winds, wind-speed probabilities, storm-surge layers; basins Atlantic/EPAC/CPAC + archives; GIS RSS (`gis-at.xml` etc.) and active-storm KML (`gis/kml/nhc_active.kml`).
- Cadence: per advisory (~6-hourly in season). Coverage: Atlantic, Eastern/Central Pacific (i.e. NOT WPAC/Indian — pair with GDACS TC or JTWC for global).
- Access: keyless. US public domain.
- Fields → shape: storm position/forecast points →`lng/lat` track; max winds (kt) →`magnitudeValue` (unit "kt"); advisory time→`openedISO`/`latestISO`; watch/warning polygons→footprints. `catId="severe-storms"`, prior 0.85.
- Effort: medium (shapefile/KMZ parsing; pick latest advisory per storm). Caveats: basin gaps; cone polygon needs centroid/conversion; off-season silence.

### 1.7 Smithsonian GVP Weekly Volcanic Activity Report — fit: Med
- Owner: Smithsonian Global Volcanism Program + USGS Volcano Hazards Program.
- Endpoint **[search-verified]** (page fetch blocked 403; content confirmed in official snippet): `https://volcano.si.edu/reports_weekly.cfm` — weekly report updated Thu 2300 UTC, ~16 volcanoes/week, criteria: alert-level change, VAAC ash advisory, new activity reports. Database: `https://volcano.si.edu/` (Holocene volcano/ eruption search).
- Access: keyless HTML; **no public API** — scrape weekly page.
- Fields → shape: volcano name + coordinates (via GVP database join on volcano number/name) →`lng/lat`/`place`; week window→`openedISO`; activity wording→qualitative severity (no magnitude). `catId="volcano"`, prior 0.9.
- Effort: medium (HTML scrape + name→coordinate join; weekly cadence fits scorer half-life but misses eruption onset by days). Caveat: explicitly non-comprehensive (continuous eruptions omitted).

### 1.8 Floods: Dartmouth Flood Observatory + GloFAS — fit: Med
- DFO: mission archive of large flood events from news/govt/remote-sensing **[search-verified]** `https://floodobservatory.colorado.edu/wiki/Main_Page`; records download v0.9.0 (Jan 1985–Dec 2023, 5,513 records, **CC0**, Zenodo DOI) **[search-verified]** `https://floodobservatory.colorado.edu/wiki/FloodRecords`. Use: calibration/history + severity priors for `floods` (prior 0.95); NOT live enough as primary demand feed.
- GloFAS (CEMS-Flood): daily global ensemble discharge forecasts to 15 days, 0.05° grid, via map viewer `https://global-flood.emergency.copernicus.eu/`, WMS-T, tailored FTP, MARS, and Early Warning Data Store dataset `cems-glofas-forecast` (GRIB2/NetCDF-4) **[search-verified]** (`https://confluence.ecmwf.int/spaces/CEMS/pages/242067416/Data+Access`, `https://ewds.climate.copernicus.eu/datasets/cems-glofas-forecast`, `https://global-flood.emergency.copernicus.eu/technical-information/glofas-30day/`). Registration required; open data under GloFAS ToS. Use: *forecast* demand signal (pre-event tasking interest) + flood-risk `alertLevel`; heavy format lift (gridded) — consume threshold-exceedance summaries, not raw grids.

### 1.9 PDC DisasterAWARE — NOT verified (fit unknown)
- `https://www.pdc.org/solutions/` returned 403; no primary doc captured. PDC offers DisasterAWARE (hazard exposure, now with AI-assisted alerts) but public API terms could not be confirmed. **Do not build on it without re-verification**; likely account-gated.

## 2. War zones / conflict / humanitarian

> Sensitivity note — see bottom section. Conflict feeds carry do-no-harm,
> licensing, and operational-security constraints that natural-hazard feeds do not.

### 2.1 ACLED API — fit: Med (gated + licence-constrained)
- Owner: ACLED (Armed Conflict Location & Event Data).
- Endpoints **[search-verified]**: base `https://acleddata.com/api/` (+`/api/acled/` core dataset), auth `…/oauth/token`, guides `https://acleddata.com/api-authentication`, `https://acleddata.com/acled-api-documentation`; EULA `https://acleddata.com/eula`.
- Access: **myACLED account + OAuth (24h access / 14d refresh tokens)**. Weekly data updates (Mon/Tue).
- Licence (EULA, read): royalty-free **non-commercial, non-transferable, non-sublicensable**; external materials must be *transformative* (not reverse-engineerable to the dataset); **commercial entities need a corporate licence, public-sector bodies a public-sector licence**; no scraping; attribution mandatory. This is the tightest licence in the survey — a public TerraSignal dashboard republishing ACLED-derived points likely needs legal review/licence.
- Fields → shape: event date, lat/lng, actor pair, event/sub-event type, fatalities (→`magnitudeValue`, unit "fatalities"), admin notes →`place`. No natural-hazard `catId` — needs a new `catId` (e.g. `conflict`) + scorer weight decision (demand for imagery is real; sensitivity rules apply).
- Effort: medium (OAuth + pagination + weekly cadence). Caveat: weekly lag; coverage cut-off decisions are ACLED's, not TerraSignal's — never present as ground truth.

### 2.2 UCDP API — fit: Med
- Owner: Uppsala University, Dept. of Peace & Conflict Research.
- Endpoint **[fetched]**: `https://ucdp.uu.se/apidocs/` — REST JSON `https://ucdpapi.pcr.uu.se/api/<gedevents|ucdpprioconflict|dyadic|nonstate|onesided|battledeaths|organizedviolencecy>/<version>?…`, filters (Country/GWNo, StartDate/EndDate on `date_end`, Geography bbox, TypeOfViolence, Actor/Dyad), paging required.
- Access: free but **token by email to maintainer** (`x-ucdp-access-token` header); 5,000 req/day; versioned (current GED 26.1; candidates monthly/quarterly).
- Fields → shape: georeferenced events with lat/lng, `date_start/_end`, `deaths_*`/`best` (→magnitude), violence type, actors. Annual core + fresher *candidate* GED (monthly) — use candidates for radar, annuals for calibration. Version pinning gives reproducibility (cite version in `sources`).
- Effort: medium (token request 3–5 days; paging; candidate-vs-release handling). Caveats: research-grade, months-late for annuals; do-no-harm handling as with ACLED.

### 2.3 UN OCHA HDX (CKAN + HAPI) — fit: Med
- Owner: OCHA Centre for Humanitarian Data.
- Endpoints **[fetched]** `https://data.humdata.org/en/faqs/devs`: CKAN API `https://data.humdata.org/api/3/` (metadata search: `package_search`/`package_show`; cookbook + Solr reference linked there); file download per resource; tabular `datastore_search(_sql)`; HAPI `https://hapi.humdata.org/` (docs `https://hdx-hapi.readthedocs.io/`, interactive `…/docs`) — HAPI queries need `app_identifier` (base64 name+email) **[search-verified]**.
- Access: CKAN read keyless; HAPI keyless-with-identifier; write needs HDX token. Per-dataset licences (mostly CC BY; check `license` per package).
- Fields → shape: NOT an event feed per se — a dataset catalogue. Value: curated crisis datasets (affected-population, operational presence, displacement) that enrich `place`/severity context and validate demand; some HDX datasets carry admin-boundary geodata (join for mapping). HAPI standardised indicators (theme+location filters) suit enrichment jobs, not per-minute polling.
- Effort: low for catalogue search; medium for dataset-specific ingestion (each resource differs). Caveat: heterogeneity — budget per-dataset adapters.

### 2.4 ReliefWeb disasters + conflict coverage — fit: Med
- Same API as §1.5 (`https://apidoc.reliefweb.int/` **[fetched]**). Disaster-type taxonomy + `disasters` endpoint cover complex emergencies alongside natural hazards; `reports` carry conflict/humanitarian narratives. Same access/licence/caveats (appname, quotas, country-level geography, partner copyright). Pair with ACLED/UCDP points: ReliefWeb gives humanitarian framing + GLIDE linkage, conflict feeds give coordinates.

### 2.5 UNOSAT Emergency Mapping — fit: Low (no public API)
- Owner: UNITAR/UNOSAT.
- Sources **[fetched homepage]** `https://unosat.org/` ("delivers satellite analysis… humanitarian emergencies… disasters, complex emergencies and conflict situations"); **[search-verified]** UNITAR Myanmar/Thailand earthquake response story (`https://unitar.org/about/news-stories/stories/unosat-emergency-mapping-service-myanmar-thailand-earthquake-response-march-2025`): 24/7 EMS, 24–72h delivery, Charter trigger + GDACS-SMCS coordination (`https://smcs.unosat.org/home`), multi-format outputs. Products endpoint `https://unosat.org/products/` is JS-gated (no machine API found).
- Value to TerraSignal: independent *validation* that an event drew satellite-tasking demand (UNOSAT activation ≈ demand ground truth, incl. conflict damage assessment). Consume manually or via GDACS SMCS linkage, not polling. Licence: UN products, attribution; redistribution of imagery derivatives needs care.

### 2.6 Sentinel conflict-damage mapping — method, not a feed (fit: Low as source)
- No single official endpoint: conflict-damage assessment with Sentinel-1 coherence/Sentinel-2 change detection is a published *method* executed by UNOSAT, Copernicus EMS (sensitive activations), JRC, and researchers — not a queryable event stream. TerraSignal relevance: *supply-side* (what Sentinel can already see) rather than demand input. Track via UNOSAT/CEMS activations (§1.4, §2.5), not as an ingest.

### 2.7 GDELT 2.0 (media-demand proxy) — fit: Med
- Owner: GDELT Project.
- Endpoints **[fetched]** `https://www.gdeltproject.org/data.html`: raw CSVs (`data.gdeltproject.org`, 15-min GDELT 2.0 events/mentions/GKG incl. 65 translated languages), Google BigQuery (live tables, 15-min updates), Analysis Service exporters, DOC/GEO/TV JSON APIs (via `https://summary.gdeltproject.org`). Docs/codebooks/CAMEO lookups on same page.
- Access: 100% free/open; no key for files/BigQuery (GCP billing for BigQuery applies).
- Licence: open (Terms of Use at `https://www.gdeltproject.org/about.html#termsofuse` — re-check before redistribution).
- Fields → shape: tone-agnostic CAMEO events with lat/lng (geocoded), dates, Goldstein scale, counts (killed/affected from GKG counts files → proxy `magnitudeValue`). Fit is *proxy*: media salience ≈ commercial-imagery demand salience, but with media bias (over-covers accessible/anglophone crises, under-covers remote ones). Best use: demand *nowcast weight* layered over physical feeds, plus GKG-count death/affected trackers as severity corroboration.
- Effort: medium–high (15-min file firehose or BigQuery SQL; normalisation required — project warns on this). Caveats: false precision of geocoding; duplicates across languages; never use as sole severity source.

## 3. Other EO-demand purposes

### 3.1 Oil spills / maritime: EMSA CleanSeaNet (+ Copernicus Maritime Surveillance) — fit: Low (inaccessible)
- Owner: EMSA. Service page **[search-verified]** `https://www.emsa.europa.eu/csn-menu.html` (+`…/csn-menu/csn-service.html`, FAQ `…/csn-faq/item/2215-…`, oil-pollution-response page): SAR-based spill + vessel detection, alerts typically <20 min post-overpass, >3,000 images/year, drift modelling, **available only to participating States (EU/EFTA/candidates) via dedicated interface**.
- No public feed or API → TerraSignal cannot poll it. Note `oil-spill` already has prior 0.9 in scorer: demand signal must come from elsewhere (GDACS? no — GDACS has no spill type; EONET `oil-spill` category; news/GDELT maritime themes; national spill reports). Record as *unfillable officially* unless partnership.

### 3.2 Agriculture/drought: FEWS NET, FAO GIEWS, USDA Crop Explorer — fit: Med / Low / Low
- FEWS NET FDW REST API **[search-verified]** (`https://help.fews.net/fdw/fews-net-api`, base `https://fdw.fews.net/api`, auth `https://help.fews.net/fdw/api-authentication`): comprehensive REST (formats json/csv/xml), public extracts keyless, restricted data via JWT token (12h). Content: IPC-compatible acute-food-insecurity classifications (country/zone, current + 4mo/8mo projections), markets, agroclimatology (rainfall/NDVI dekadals) **[search-verified]** (`https://fews.net/`). Drought/food-crisis demand is slow-onset — map IPC phase≥3 zones to `drought`/`food-insecurity` demand polygons with monthly refresh. Effort medium (zone geometries + phase mapping). Licence: US-government public, attribution.
- FAO GIEWS **[fetched]** `https://www.fao.org/giews/en/` (FPMA food prices, Crop Prospects, Country Briefs, ASIS earth observation): authoritative severity context, **no event API** — scrape-resistant reports; use as calibration, not radar input.
- USDA Crop Explorer **[search-verified]** (`https://ipad.fas.usda.gov/cropexplorer/`, datasources `…/datasources.aspx`): global agromet/NDVI/soil-moisture imagery viewer; **no public API**; archive subscriber-only. Same verdict as GIEWS.

### 3.3 Deforestation/fires: GFW Data API + EFFIS — fit: High / High
- GFW Data API **[search-verified]** (`https://data-api.globalforestwatch.org/`): datasets incl. `gfw_integrated_alerts` (integrated deforestation), `umd_glad_dist_alerts` (DIST all-ecosystem disturbance), GLAD-S2 (10 m, ~5-day, daily updates), GLAD-Landsat (30 m, weekly); query by SQL+polygon (`POST …/dataset/{id}/latest/query/json`), fields `…__date`, `…__confidence` (low/nominal/high), `…__intensity`, lat/lng. **API key required** (`x-api-key`, free signup). Licence CC BY 4.0 (WRI — confirm per dataset). → Cluster alerts into deforestation/fire-disturbance events: centroid→`lng/lat`, alert date→`openedISO`, intensity/confidence→severity. Fits `wildfires`/new `deforestation` catId. Effort medium (polygon-tiled polling; Geostore AOIs).
- EFFIS **[fetched]** (`https://effis.jrc.ec.europa.eu/`, data/services `https://effis.jrc.ec.europa.eu/applications/data-and-services`): daily MODIS/VIIRS active fires + burnt-area perimeters via **keyless WMS/WFS** (e.g. `…/effis?service=WFS&request=getfeature&typename=ms:modis.ba.poly…` SHAPEZIP/SpatiaLite), fire-danger forecast layers, severity GeoTIFFs; use under linked licence (acknowledge). Coverage EU + MENA + GWIS global viewer (`https://gwis.jrc.ec.europa.eu/` — re-verify). Burnt-area polygons are ready-made fire footprints for supply/demand scoring. Effort low–medium (WFS polling). Pair: GFW global + EFFIS authoritative EU.

### 3.4 Water quality / algal blooms — NOT verified
- No primary source captured (Copernicus Marine Service / EUMETSAT ocean colour were not fetched this pass). `water-quality` (prior 0.6) and `lakes` stay on EONET-only. Follow-up: `marine.copernicus.eu` product catalogue + EUMETSAT data store.

### 3.5 Volcanic ash / air quality: VAAC London QVA API + CAMS — fit: Med / Med
- VAAC London QVA API **[search-verified]** (`https://www.metoffice.gov.uk/services/transport/aviation/regulated/international-aviation/vaac/qva/qva-api`, user guide PDF on same domain): OGC EDR API, gridded deterministic/probabilistic ash concentration (NetCDF) + IWXXM polygons, AMQP eruption notifications; **registration + licence acceptance required, free for aviation users**; aviation-scoped redistribution. Traditional text/graphical VAAs also exist (same VAAC pages). → Eruption notifications = ash-demand trigger; polygons = aviation NO-GO footprints (imagery demand proxy). Effort medium (registration + NetCDF/IWXXM handling). Pair with GVP (§1.7) for onset.
- CAMS **[fetched homepage]** `https://atmosphere.copernicus.eu/` (CAMS Fire Emissions Watch, aerosol/air-quality forecasts, GHG/methane hotspot explorer): Copernicus open data; programmatic access via Atmosphere Data Store (not fetched — re-verify at `ads.atmosphere.copernicus.eu`). Use: smoke/aerosol load as fire-severity corroboration + dust-haze demand. Effort medium.

### 3.6 Parametric insurance / climate-finance triggers — analytic layer, not a feed
- No single primary feed: triggers are contract-specific thresholds on third-party data (e.g. USGS magnitude, NHC wind speed, GloFAS discharge, IPC phase). TerraSignal relevance: expose `magnitudeValue/Unit` + footprints in trigger-ready form (peril, threshold variable, admin geometry) so insurers can evaluate. No integration; design output schema accordingly.

### 3.7 Infrastructure monitoring demand — proxy via activations
- No public "infrastructure Incidents" API verified. Demand proxy: Copernicus EMS activations with infrastructure-relevant categories + UNOSAT products + GDELT construction/disaster themes. Long-term: International Charter activations (`https://disasterscharter.org/` — not fetched this pass; re-verify) as tasking-demand ground truth.

## Recommended top-5 integration order

1. **USGS Earthquake GeoJSON** — keyless, per-minute, near-perfect shape fit (`mag/place/time/alert/coords`); highest value/effort ratio; dedupe key vs GDACS-EQ via spatiotemporal window. Effort: ~hours (mirror EONET poller).
2. **GDACS extended APIs** — builds on the existing GDACS parser: per-hazard RSS (EQ/TC/flood slices) + `geteventdata` enrichment + TC/flood footprints. Unlocks `alertLevel` grounding and polygon supply scoring. Effort: ~1–2 days (pagination + footprint centroids).
3. **NASA FIRMS** — only sub-daily global fire-demand signal in the survey; free key; FRP→magnitude maps to scorer's top-weight category (`wildfires` 1.0). Needs hotspot clustering. Effort: ~2–3 days.
4. **Copernicus EMS Mapping API** — keyless; activations are *confirmed satellite-tasking demand* with AOI polygons + `gdacsId` cross-link; spans quake/flood/fire/storm. Effort: ~1–2 days; handle authorisation lag + `sensitive` flags.
5. **ReliefWeb v2 disasters** — humanitarian severity + GLIDE dedupe keys across all feeds; free but **apply for pre-approved appname now** (mandatory since 2025-11-01) and respect 1000/day quotas + partner copyright. Effort: ~1–2 days; country-level geography needs geocoding.

Rationale: all five are free/keyless-or-free-key, polling-friendly JSON/RSS, map cleanly onto `{…openedISO, lng/lat, magnitude, alertLevel}`, and cover the scorer's highest priors (wildfires 1.0, floods 0.95, severe-storms/volcano 0.85–0.9, earthquake 0.85). GFW+EFFIS next (fire/deforestation depth), then NHC-GIS (basin-limited), then gated/conflict sources after legal review.

## War-zone / sensitivity note

- **Do-no-harm**: conflict event data can endanger sources and civilians. Never publish unit-level movements, never real-time IActionable targeting detail; aggregate (admin-1 or grid), delay (≥7 days), and strip source strings before display. UCDP/ACLED document their own sensitivity policies — follow the stricter of theirs and OCHA's.
- **Licensing**: ACLED (corporate/public-sector licence required for commercial/state use; transformative-only republication), UCDP (research-oriented, token-gated), ReliefWeb (partner copyright), UNOSAT/CEMS-sensitive (restricted). Resolve TerraSignal's commercial posture *before* ingesting ACLED.
- **Epistemics**: conflict datasets are curated claims, not physical measurements — contradictory coding across ACLED/UCDP is normal. Present fatalities as ranges (UCDP `low/best/high`), version-pin UCDP calls in `sources`, and keep a `conflict` catId + prior separate from natural-hazard priors so war demand never silently outranks disaster demand (or vice versa).
- **Ops**: ACLED weekly + UCDP annual/candidate cadences cannot drive same-day tasking; use them for persistent-crisis demand baselines, GDELT for salience nowcast, and physical feeds for trigger timing.

## Feeds NOT verified (do not build on without re-check)

- **PDC DisasterAWARE / Disaster Alert** — `pdc.org/solutions/` 403; no API/licence doc captured.
- **Water quality / algal blooms** — no primary source fetched (try Copernicus Marine, EUMETSAT).
- **International Charter activations feed** — referenced from UNITAR story; `disasterscharter.org` not fetched.
- **CAMS programmatic (ADS API)** — homepage fetched; `ads.atmosphere.copernicus.eu` docs not fetched.
- **GWIS global viewer** — linked from EFFIS; not fetched.
- **GVP detail pages** — weekly report confirmed via official snippet; full-page fetch 403 (re-fetch or use USGS cross-feed).
- **UNOSAT products API** — none found (JS site); treat as no-API unless SMCS offers one.
- **EMSA / CleanSeaNet** — verified as *existing but inaccessible* (member-state only); no further check needed unless partnership arises.
