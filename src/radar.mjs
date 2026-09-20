import { fetchOpenEvents } from './eonet.mjs';
import { fetchGdacsEvents } from './gdacs.mjs';
import { scenesAroundPoint, countScenes } from './stac.mjs';
import { scoreEvent, demandScore } from './score.mjs';
import { cached } from './cache.mjs';
import { pool } from './http.mjs';

export const REGIONS = {
  eu: { label: 'Europe', bbox: [-30, 30, 50, 72] },
  global: { label: 'Global', bbox: null },
};

export async function buildRadar({ region = 'eu', days = 45, focus = 30, concurrency = 6 } = {}) {
  const reg = REGIONS[region] ?? REGIONS.eu;
  const nowMs = Date.now();

  const [gdacs, eonet] = await Promise.all([
    cached(`gdacs:${region}:${days}`, 10 * 60_000, () => fetchGdacsEvents({ bbox: reg.bbox })),
    cached(`eonet:${region}:${days}`, 10 * 60_000, () => fetchOpenEvents({ bbox: reg.bbox, days })),
  ]);
  const events = mergeDemand(gdacs, eonet, nowMs, days);

  const byDemand = [...events].sort((a, b) => demandScore(b, nowMs) - demandScore(a, nowMs));
  const selected = byDemand.slice(0, focus);

  const enriched = await pool(selected, concurrency, async (evt) => {
    const sinceISO = new Date(Math.max(Date.parse(evt.openedISO), nowMs - 45 * 86_400_000)).toISOString();
    const scenes = await cached(
      `s2:${evt.id}:${sinceISO.slice(0, 10)}`,
      15 * 60_000,
      () => scenesAroundPoint({ lng: evt.lng, lat: evt.lat, sinceISO, limit: 25 }),
    ).catch(() => []);
    const scored = scoreEvent(evt, scenes, nowMs);
    return {
      ...scored,
      footprints: scenes.slice(0, 12).map((s) => ({ dt: s.dt, cloud: s.cloud, platform: s.platform, geom: s.geom })),
      recentScenes: scenes.slice(0, 6).map(({ id, dt, cloud, platform, thumb }) => ({ id, dt, cloud, platform, thumb })),
    };
  });

  enriched.sort((a, b) => b.opportunity - a.opportunity || b.serviceable - a.serviceable);

  const totalDemand = enriched.reduce((s, e) => s + e.demand / 100, 0) || 1;
  const unmet = enriched.reduce((s, e) => s + (e.demand / 100) * (1 - e.supply), 0) / totalDemand;

  const pulse = await cached('pulse:24h', 10 * 60_000, async () => ({
    global24h: await countScenes({ windowHours: 24 }).catch(() => null),
    eu24h: await countScenes({ bbox: [-25, 34, 45, 72], windowHours: 24 }).catch(() => null),
  })).catch(() => ({}));

  return {
    generatedAt: new Date(nowMs).toISOString(),
    region: reg.label,
    days,
    kpis: {
      eventsInScope: events.length,
      eventsAnalysed: enriched.length,
      gaps: enriched.filter((e) => e.cls === 'TASKING GAP').length,
      ready: enriched.filter((e) => e.cls === 'COPERNICUS-READY').length,
      unmetSharePct: Math.round(unmet * 100),
      scenes24h: pulse.global24h ?? null,
      euScenes24h: pulse.eu24h ?? null,
    },
    events: enriched,
  };
}

/** GDACS alerts win proximity conflicts (official, has severity); then dedupe within feed. */
function mergeDemand(gdacs, eonet, nowMs, days) {
  const cutoff = nowMs - days * 86_400_000;
  const daysCutoff = (e) => {
    const t = Date.parse(e.openedISO);
    return t > nowMs || t >= cutoff;
  };
  const out = [];
  for (const e of [...gdacs, ...eonet]) {
    if (!daysCutoff(e) || e.lat == null) continue;
    const dup = out.find(
      (o) =>
        (o.catId === e.catId || Math.abs(o.lat - e.lat) + Math.abs(o.lng - e.lng) < 1) &&
        Math.hypot(o.lat - e.lat, (o.lng - e.lng) * Math.cos((e.lat * Math.PI) / 180)) < 2,
    );
    if (dup) {
      dup.mergedFrom = [...(dup.mergedFrom ?? [dup.src]), e.src];
      dup.magnitudeValue ??= e.magnitudeValue;
      dup.magnitudeUnit ??= e.magnitudeUnit;
      continue;
    }
    out.push({ ...e });
  }
  return out;
}
