// Copernicus catalogue queries (Element 84 Earth Search STAC, keyless, CORS-open).
// Isomorphic: the browser calls this directly for AOI scoring on the static site.
import { fetchJson } from './http.mjs';

export const STAC = 'https://earth-search.aws.element84.com/v1/search';
export const COLLECTION = 'sentinel-2-l2a';
export const SAR_COLLECTION = 'sentinel-1-grd';

function toScene(f) {
  return {
    id: f.id,
    dt: f.properties.datetime,
    cloud: f.properties['eo:cloud_cover'] ?? null,
    platform: f.properties.platform ?? null,
    orbit: f.properties['sat:orbit_state'] ?? null,
    thumb: f.assets?.thumbnail?.href ?? null,
    geom: f.geometry ?? null,
  };
}

export function bboxAround({ lng, lat, marginDeg }) {
  const lngMargin = marginDeg / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return [lng - lngMargin, lat - marginDeg, lng + lngMargin, lat + marginDeg];
}

/**
 * Scenes of `collection` whose footprint intersects a small box around a point,
 * acquired since the given ISO date, newest first.
 */
export async function scenesAroundPoint({ lng, lat, sinceISO, marginDeg = 0.18, limit = 25, collection = COLLECTION }) {
  if (lng == null || lat == null) return [];
  const body = {
    collections: [collection],
    bbox: bboxAround({ lng, lat, marginDeg }),
    datetime: `${sinceISO}/..`,
    limit,
    sort: [{ field: 'properties.datetime', direction: 'desc' }],
  };
  if (collection === SAR_COLLECTION) body.fields = { excludes: ['geometry'] }; // only dates matter
  const data = await fetchJson(STAC, { method: 'POST', body });
  return (data.features ?? []).map(toScene);
}

export const sarScenesAroundPoint = (args) => scenesAroundPoint({ ...args, collection: SAR_COLLECTION, limit: 15 });

/** Count of Sentinel-2 scenes ingested worldwide / in a bbox within a window. */
export async function countScenes({ bbox, windowHours = 24, collection = COLLECTION }) {
  const since = new Date(Date.now() - windowHours * 3_600_000).toISOString();
  const body = {
    collections: [collection],
    datetime: `${since}/..`,
    limit: 1,
    fields: { excludes: ['geometry'] },
  };
  if (bbox) body.bbox = bbox;
  const data = await fetchJson(STAC, { method: 'POST', body });
  return data.context?.matched ?? data.numberMatched ?? 0;
}
