import { fetchJson } from '../core/http.mjs';

export const id = 'CEMS';
export const label = 'Copernicus EMS — rapid-mapping activations (confirmed tasking demand)';

const API = 'https://mapping.emergency.copernicus.eu/activations/api/activations/?limit=100';
const CATEGORY = {
  flood: 'floods',
  fire: 'wildfires',
  storm: 'severe-storms',
  earthquake: 'earthquake',
  volcan: 'volcano',
  'mass-movement': 'landslide',
  other: 'manual-events',
};

export async function fetchEvents({ bbox, days = 45 } = {}) {
  return parseActivations(await fetchJson(API), { bbox, days });
}

/**
 * Activations still open, or updated inside the window. An activation means the
 * EU has commissioned satellite mapping — the strongest demand proof available.
 */
export function parseActivations(data, { bbox, days = 45, nowMs = Date.now() } = {}) {
  const cutoff = nowMs - days * 86_400_000;
  const out = [];
  for (const a of data.results ?? []) {
    if (a.sensitive) continue; // restricted activations: never surface
    const m = /POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/.exec(a.centroid ?? '');
    if (!m) continue;
    const [lng, lat] = [Number(m[1]), Number(m[2])];
    const activated = Date.parse(a.activationTime + 'Z');
    const updated = Date.parse((a.lastUpdate ?? a.activationTime) + 'Z');
    if (activated < cutoff && a.closed) continue;
    if (bbox && (lng < bbox[0] || lat < bbox[1] || lng > bbox[2] || lat > bbox[3])) continue;
    out.push({
      id: `CEMS_${a.code}`,
      title: a.name,
      place: (a.countries ?? []).map((c) => c.short_name).join(', '),
      catId: CATEGORY[a.category?.slug] ?? 'manual-events',
      prior: a.closed ? 0.8 : 1.0,
      openedISO: new Date(activated).toISOString(),
      latestISO: new Date(updated).toISOString(),
      lng,
      lat,
      magnitudeValue: null,
      magnitudeUnit: null,
      alertLevel: null,
      activation: a.code,
      src: 'CEMS',
      sources: [`https://mapping.emergency.copernicus.eu/activations/${a.code}/`],
    });
  }
  return out;
}
