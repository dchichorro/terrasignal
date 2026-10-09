import { fetchJson } from '../core/http.mjs';

export const id = 'USGS';
export const label = 'USGS — real-time global earthquakes';

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson';
const ALERT_PRIOR = { red: 1.0, orange: 0.9, yellow: 0.8, green: 0.45 };
const MIN_MAG = 6; // below this, damage (and imagery demand) is rare unless PAGER escalates
const SIGNIFICANT = 600; // USGS 'sig' threshold for its own significant-events list

export async function fetchEvents({ bbox, days = 45 } = {}) {
  return parseFeed(await fetchJson(FEED), { bbox, days });
}

/** USGS GeoJSON → unified events. Keeps M≥6, PAGER yellow+ or USGS-significant quakes. */
export function parseFeed(data, { bbox, days = 45, nowMs = Date.now() } = {}) {
  const cutoff = nowMs - days * 86_400_000;
  const out = [];
  for (const f of data.features ?? []) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || p.type !== 'earthquake') continue;
    if (!(p.mag >= MIN_MAG || (p.alert && p.alert !== 'green') || p.sig >= SIGNIFICANT)) continue;
    if (p.time < cutoff) continue;
    if (bbox && (lng < bbox[0] || lat < bbox[1] || lng > bbox[2] || lat > bbox[3])) continue;
    out.push({
      id: `USGS_${f.id}`,
      title: `Earthquake M${p.mag?.toFixed(1)}${p.place ? `, ${p.place.replace(/^.*? of /, '')}` : ''}`,
      place: p.place ?? '',
      catId: 'earthquake',
      prior: ALERT_PRIOR[p.alert] ?? (p.mag >= 7 ? 0.9 : p.mag >= 6.5 ? 0.8 : p.mag >= 6 ? 0.65 : 0.5),
      openedISO: new Date(p.time).toISOString(),
      latestISO: new Date(p.updated ?? p.time).toISOString(),
      lng,
      lat,
      magnitudeValue: p.mag ?? null,
      magnitudeUnit: p.magType ?? 'M',
      alertLevel: p.alert ? p.alert[0].toUpperCase() + p.alert.slice(1) : null,
      tsunami: p.tsunami === 1,
      src: 'USGS',
      sources: [p.url].filter(Boolean),
    });
  }
  return out;
}
