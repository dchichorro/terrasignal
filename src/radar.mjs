// Orchestration: pull demand feeds, merge, scan Copernicus supply per event,
// score, attach commercial lead fields, compute KPIs.
// Dependencies (feeds, catalogue, cache) are injectable — tests run offline.
import { SOURCES } from './sources/index.mjs';
import { scenesAroundPoint, sarScenesAroundPoint, countScenes } from './core/stac.mjs';
import { scoreEvent, demandScore } from './core/score.mjs';
import { mergeDemand } from './core/merge.mjs';
import { toLead, pipelineTotals } from './core/value.mjs';
import { scoreAoi, sliceScenes } from './core/aoi.mjs';
import { pool } from './core/http.mjs';
import { cached as diskCached } from './lib/cache.mjs';

export const REGIONS = {
  eu: { label: 'Europe', bbox: [-30, 30, 50, 72] },
  global: { label: 'Global', bbox: null },
};

const MIN = 60_000;

export const defaultSupply = {
  optical: scenesAroundPoint,
  sar: sarScenesAroundPoint,
  pulse: async () => ({
    global24h: await countScenes({ windowHours: 24 }).catch(() => null),
    eu24h: await countScenes({ bbox: [-25, 34, 45, 72], windowHours: 24 }).catch(() => null),
  }),
};

export async function buildRadar({
  region = 'eu',
  days = 45,
  focus = 30,
  concurrency = 6,
  sources = SOURCES,
  supply = defaultSupply,
  cached = diskCached,
  nowMs = Date.now(),
} = {}) {
  const reg = REGIONS[region] ?? REGIONS.eu;

  // a dead feed must not take the radar down: report it and carry on
  const feedStatus = {};
  const feeds = await Promise.all(
    sources.map((s) =>
      cached(`${s.id.toLowerCase()}:${region}:${days}`, 10 * MIN, () => s.fetchEvents({ bbox: reg.bbox, days }))
        .then((evts) => ((feedStatus[s.id] = { ok: true, events: evts.length }), evts))
        .catch((err) => ((feedStatus[s.id] = { ok: false, error: String(err?.message ?? err) }), [])),
    ),
  );
  const events = mergeDemand(feeds, nowMs, days);

  const byDemand = [...events].sort((a, b) => demandScore(b, nowMs) - demandScore(a, nowMs));
  const selected = byDemand.slice(0, focus);

  const enriched = await pool(selected, concurrency, async (evt) => {
    const sinceISO = new Date(Math.max(Date.parse(evt.openedISO), nowMs - 45 * 86_400_000)).toISOString();
    const q = { lng: evt.lng, lat: evt.lat, sinceISO };
    const [scenes, sarScenes] = await Promise.all([
      cached(`s2:${evt.id}:${sinceISO.slice(0, 10)}`, 15 * MIN, () => supply.optical({ ...q, limit: 25 })).catch(() => []),
      cached(`s1:${evt.id}:${sinceISO.slice(0, 10)}`, 15 * MIN, () => supply.sar(q)).catch(() => null),
    ]);
    return toLead({ ...scoreEvent(evt, scenes, nowMs, { sarScenes: sarScenes ?? undefined }), ...sliceScenes(scenes) });
  });

  enriched.sort((a, b) => b.opportunity - a.opportunity || b.serviceable - a.serviceable);

  const totalDemand = enriched.reduce((s, e) => s + e.demand / 100, 0) || 1;
  const unmet = enriched.reduce((s, e) => s + (e.demand / 100) * (1 - e.supply), 0) / totalDemand;
  const pulse = await cached('pulse:24h', 10 * MIN, supply.pulse).catch(() => ({}));
  const pipeline = pipelineTotals(enriched);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    region: reg.label,
    days,
    feeds: feedStatus,
    kpis: {
      eventsInScope: events.length,
      eventsAnalysed: enriched.length,
      gaps: enriched.filter((e) => e.cls === 'TASKING GAP').length,
      ready: enriched.filter((e) => e.cls === 'COPERNICUS-READY').length,
      activations: enriched.filter((e) => e.activation).length,
      unmetSharePct: Math.round(unmet * 100),
      commercialSharePct: Math.round((100 * enriched.reduce((s, e) => s + e.opportunity, 0)) / (100 * totalDemand)),
      scenes24h: pulse.global24h ?? null,
      euScenes24h: pulse.eu24h ?? null,
      pipelineEUR: pipeline.totalEUR,
      taskingPipelineEUR: pipeline.taskingEUR,
      analyticsPipelineEUR: pipeline.analyticsEUR,
    },
    events: enriched,
  };
}

/** Score a user-placed pin, catalogue calls disk-cached by rounded location. */
export function buildAoi(input, { cached = diskCached, supply = defaultSupply } = {}) {
  const key = (kind, q) => `aoi-${kind}:${q.lat.toFixed(3)}:${q.lng.toFixed(3)}:${q.marginDeg.toFixed(3)}:${q.sinceISO.slice(0, 10)}`;
  return scoreAoi(input, {
    fetchers: {
      optical: (q) => cached(key('s2', q), 15 * MIN, () => supply.optical({ ...q, limit: 25 })),
      sar: (q) => cached(key('s1', q), 15 * MIN, () => supply.sar(q)),
    },
  });
}
