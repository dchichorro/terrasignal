# 08 NASA FIRMS feed

Status: ready-for-agent
Type: task
Needs: FIRMS MAP_KEY (human signup) for live verification only

## Why
FIRMS is the only sub-daily global fire-demand signal (see
`docs/feed-research.md` §1.3). EONET wildfire coverage is slower and skews to
the US.

## Scope
- `src/sources/firms.mjs` follows the source-module contract (`id`, `label`,
  `fetchEvents`, plus an exported parser). It uses the `area/csv` API with
  `VIIRS_SNPP_NRT` and `VIIRS_NOAA20_NRT`, a 1–2 day range, and region bboxes
  from the regions config.
- Cluster hotspots into events: a grid/DBSCAN-lite clustering in a pure
  `src/core/cluster.mjs` (e.g. 5 km linkage, 48 h window). For each event,
  centroid → lat/lng, summed FRP → `magnitudeValue` (MW), hotspot count, and
  first-detection time → `openedISO`. `catId = wildfires`.
- Drop low-signal clusters (fewer than N hotspots, or low confidence only).
  Thresholds are named constants.
- If `FIRMS_MAP_KEY` is missing, the source reports as `disabled` in
  `radar.feeds` (not as `down`). The UI shows that.
- Source precedence in `merge.mjs`: FIRMS ranks below GDACS/EONET for the same
  fire (it enriches rather than duplicates).

## Acceptance
- Offline tests run on a fixture CSV and cover the parser, the clustering, and
  dedupe against an EONET wildfire at the same place.
- The radar runs unchanged when there is no key.
