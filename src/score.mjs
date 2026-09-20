// Pure scoring model: how strong is the data *demand* from an event, how well
// does free Copernicus imagery *supply* it, and where is the commercial gap?

export const CATEGORY_WEIGHT = {
  wildfires: 1.0,
  floods: 0.95,
  volcano: 0.9,
  'oil-spill': 0.9,
  landslide: 0.8,
  'severe-storms': 0.85,
  earthquake: 0.85,
  drought: 0.7,
  avalanche: 0.7,
  'water-quality': 0.6,
  lakes: 0.6,
  'sea-ice': 0.5,
  icebergs: 0.5,
  snow: 0.4,
  'dust-haze': 0.5,
  'manual-events': 0.6,
};

const RECENCY_HALFLIFE_DAYS = 20; // demand signal decays as events age
const FRESHNESS_SCALE_DAYS = 7; // S2 constellation revisit ~5 days

export function demandScore(event, nowMs) {
  const weight = event.prior ?? CATEGORY_WEIGHT[event.catId] ?? 0.6;
  const opened = Date.parse(event.openedISO);
  if (Number.isNaN(opened)) return 0;
  const ageDays = Math.max(0, (nowMs - opened) / 86_400_000);
  const recency = Math.pow(0.5, ageDays / RECENCY_HALFLIFE_DAYS);
  let boost = 1;
  if (event.magnitudeValue > 0) {
    boost = 1 + Math.min(0.5, 0.125 * Math.log10(1 + event.magnitudeValue));
  }
  return clamp01(weight * recency * boost);
}

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function supplyStats(scenes, nowMs) {
  if (!scenes?.length) {
    return { count: 0, lastAgeDays: null, medianCloud: null, cadenceDays: null, supply: 0 };
  }
  // one pass = one acquisition day (a point often sits on 2 adjacent tiles, same overpass)
  const dates = [...new Set(scenes.map((s) => s.dt?.slice(0, 10)).filter(Boolean))]
    .map((d) => Date.parse(d + 'T12:00:00Z'))
    .sort((a, b) => b - a);
  if (!dates.length) {
    return { count: 0, lastAgeDays: null, medianCloud: null, cadenceDays: null, supply: 0 };
  }
  const newest = dates[0];
  const lastAgeDays = (nowMs - newest) / 86_400_000;
  const medianCloud = median(scenes.map((s) => s.cloud));
  const gaps = [];
  for (let i = 1; i < dates.length; i++) gaps.push((dates[i - 1] - dates[i]) / 86_400_000);
  const cadenceDays = gaps.length ? median(gaps) : null;
  const fresh = Math.exp(-Math.max(0, lastAgeDays) / FRESHNESS_SCALE_DAYS);
  const clear = medianCloud == null ? 0.5 : 1 - clamp01(medianCloud / 100);
  return {
    count: dates.length,
    lastAgeDays: round1(lastAgeDays),
    medianCloud: medianCloud == null ? null : round1(medianCloud),
    cadenceDays: cadenceDays == null ? null : round1(cadenceDays),
    supply: clamp01(0.65 * fresh + 0.35 * clear),
  };
}

export function classify(supply) {
  if (supply < 0.35) return 'TASKING GAP'; // no usable free data — commercial VHR opportunity
  if (supply >= 0.65) return 'COPERNICUS-READY'; // fresh + clear — service it today
  return 'PARTIAL';
}

export function scoreEvent(event, scenes, nowMs = Date.now()) {
  const demand = demandScore(event, nowMs);
  const stats = supplyStats(scenes, nowMs);
  const opportunity = Math.round(100 * demand * (1 - stats.supply)); // tasking gap $ signal
  const serviceable = Math.round(100 * demand * stats.supply); // sellable off free data today
  return {
    ...event,
    ...stats,
    demand: round1(100 * demand),
    opportunity,
    serviceable,
    cls: classify(stats.supply),
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const round1 = (x) => Math.round(x * 10) / 10;
