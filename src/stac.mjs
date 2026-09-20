import { fetchJson } from './http.mjs';

const STAC = 'https://earth-search.aws.element84.com/v1/search';
export const COLLECTION = 'sentinel-2-l2a';

function toScene(f) {
  return {
    id: f.id,
    dt: f.properties.datetime,
    cloud: f.properties['eo:cloud_cover'] ?? null,
    platform: f.properties.platform ?? null,
    thumb: f.assets?.thumbnail?.href ?? null,
    geom: f.geometry ?? null,
  };
}

/**
 * Sentinel-2 L2A scenes whose footprint intersects a small box around a point,
 * acquired since the given ISO date.
 */
export async function scenesAroundPoint({ lng, lat, sinceISO, marginDeg = 0.18, limit = 25 }) {
  if (lng == null || lat == null) return [];
  const lngMargin = marginDeg / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const bbox = [lng - lngMargin, lat - marginDeg, lng + lngMargin, lat + marginDeg];
  const body = {
    collections: [COLLECTION],
    bbox,
    datetime: `${sinceISO}/..`,
    limit,
    sort: [{ field: 'properties.datetime', direction: 'desc' }],
  };
  const data = await fetchJson(STAC, { method: 'POST', body });
  return (data.features ?? []).map(toScene);
}

/** Same, but returns full scene footprints (small polygons) capped to `keep`. */
export async function footprintsAroundPoint({ lng, lat, sinceISO, marginDeg = 0.18, keep = 12 }) {
  const scenes = await scenesAroundPoint({ lng, lat, sinceISO, marginDeg, limit: keep });
  return scenes.map((s) => ({ dt: s.dt, platform: s.platform, cloud: s.cloud, geom: s.geom }));
}

/** Count of Sentinel-2 scenes ingested worldwide / in a bbox within a window. */
export async function countScenes({ bbox, windowHours = 24 }) {
  const since = new Date(Date.now() - windowHours * 3_600_000).toISOString();
  const body = {
    collections: [COLLECTION],
    datetime: `${since}/..`,
    limit: 1,
    fields: { excludes: ['geometry'] },
  };
  if (bbox) body.bbox = bbox;
  const data = await fetchJson(STAC, { method: 'POST', body });
  return data.context?.matched ?? data.numberMatched ?? 0;
}
