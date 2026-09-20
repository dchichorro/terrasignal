import { fetchJson } from './http.mjs';
import { CATEGORY_WEIGHT } from './score.mjs';

const BASE = 'https://eonet.gsfc.nasa.gov/api/v3/events';

const EO_CATEGORIES = new Set([...Object.keys(CATEGORY_WEIGHT), 'lakes', 'icebergs', 'snow', 'dust-haze']);

/**
 * Open EONET events, EO-relevant, newest geometry point kept.
 * EONET's server-side geo filter is unreliable, so we bbox client-side.
 */
export async function fetchOpenEvents({ bbox, days = 60, maxEvents = 2000 } = {}) {
  const data = await fetchJson(`${BASE}?status=open&limit=${maxEvents}`);
  const cutoff = Date.now() - days * 86_400_000;
  return (data.events ?? [])
    .map((e) => normalize(e))
    .filter((e) => e && EO_CATEGORIES.has(e.catId))
    .filter((e) => Date.parse(e.openedISO) >= cutoff)
    .filter((e) => !bbox || (e.lng >= bbox[0] && e.lat >= bbox[1] && e.lng <= bbox[2] && e.lat <= bbox[3]));
}

function normalize(e) {
  const geom = e.geometry ?? [];
  const last = geom[geom.length - 1];
  if (!last?.coordinates) return null;
  return {
    id: e.id,
    title: e.title,
    place: e.description ?? '',
    catId: e.categories?.[0]?.id ?? 'unknown',
    prior: null,
    openedISO: geom[0]?.date ?? last.date,
    latestISO: last.date,
    lng: last.coordinates[0],
    lat: last.coordinates[1],
    magnitudeValue: last.magnitudeValue ?? null,
    magnitudeUnit: last.magnitudeUnit ?? null,
    src: 'EONET',
    alertLevel: null,
    sources: (e.sources ?? []).slice(0, 2).map((s) => s.url),
  };
}
