// Pure scoring model: how strong is the data *demand* from an event, how well
// does free Copernicus imagery *supply* it, and where is the commercial gap?
// Isomorphic: runs in Node and in the browser (no node: imports in src/core).

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

// How much a radar (Sentinel-1) look can stand in for an optical one, per hazard.
// SAR sees through cloud and at night: decisive for floods and ground deformation,
// weak for burn severity or vegetation stress.
export const SAR_UTILITY = {
  floods: 1.0,
  'oil-spill': 1.0,
  earthquake: 0.9,
  'sea-ice': 0.9,
  icebergs: 0.9,
  landslide: 0.8,
  'severe-storms': 0.8,
  volcano: 0.7,
  avalanche: 0.6,
  wildfires: 0.4,
  lakes: 0.5,
  snow: 0.4,
  'manual-events': 0.5,
  drought: 0.2,
  'water-quality': 0.1,
  'dust-haze': 0.1,
};

// Share of an event's imagery need that only very-high-resolution (<1 m) data can
// meet — building-level damage grading, debris, access routes. Free 10 m Sentinel
// data can never serve this slice, however fresh: it is the commercial VHR market.
export const VHR_NEED = {
  earthquake: 0.7,
  tsunami: 0.6,
  'severe-storms': 0.5,
  landslide: 0.5,
  avalanche: 0.4,
  'manual-events': 0.4,
  floods: 0.35,
  volcano: 0.3,
  wildfires: 0.25,
  'oil-spill': 0.2,
  icebergs: 0.1,
  drought: 0.05,
  lakes: 0.05,
};

const RECENCY_HALFLIFE_DAYS = 20; // demand signal decays as events age
const FRESHNESS_SCALE_DAYS = 7; // S2 constellation revisit ~5 days
const SAR_FRESHNESS_SCALE_DAYS = 9; // S1 revisit ~6 days with S1C/S1D

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
  // an EU Copernicus EMS activation is confirmed, funded tasking demand
  if (event.activation) boost *= 1.15;
  return clamp01(weight * recency * boost);
}

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Distinct acquisition days, newest first (a point often sits on 2 adjacent tiles, same overpass). */
function passDays(scenes) {
  return [...new Set(scenes.map((s) => s.dt?.slice(0, 10)).filter(Boolean))]
    .map((d) => Date.parse(d + 'T12:00:00Z'))
    .sort((a, b) => b - a);
}

export function supplyStats(scenes, nowMs) {
  const empty = { count: 0, lastAgeDays: null, medianCloud: null, cadenceDays: null, supply: 0 };
  if (!scenes?.length) return empty;
  const dates = passDays(scenes);
  if (!dates.length) return empty;
  const lastAgeDays = (nowMs - dates[0]) / 86_400_000;
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

/** Sentinel-1 radar supply: freshness only — cloud is irrelevant to SAR. */
export function sarStats(scenes, nowMs) {
  const dates = passDays(scenes ?? []);
  if (!dates.length) return { sarCount: 0, sarLastAgeDays: null, sarSupply: 0 };
  const age = (nowMs - dates[0]) / 86_400_000;
  return {
    sarCount: dates.length,
    sarLastAgeDays: round1(age),
    sarSupply: clamp01(Math.exp(-Math.max(0, age) / SAR_FRESHNESS_SCALE_DAYS)),
  };
}

/**
 * Free supply from both missions. A SAR look covers the part of the need that
 * radar can serve for this hazard: S = 1 − (1 − S_opt)·(1 − u_cat·S_sar).
 */
export function combinedSupply(opticalSupply, sarSupply, catId) {
  const u = SAR_UTILITY[catId] ?? 0.5;
  return clamp01(1 - (1 - opticalSupply) * (1 - u * sarSupply));
}

export function classify(supply) {
  if (supply < 0.35) return 'TASKING GAP'; // no usable free data — commercial opportunity
  if (supply >= 0.65) return 'COPERNICUS-READY'; // fresh + clear — service it today
  return 'PARTIAL';
}

/** Why free optical imagery falls short — the first line of a sales conversation. */
export function gapReason(stats) {
  if (!stats.count) return 'no-pass';
  if (stats.lastAgeDays > 10) return 'stale';
  if (stats.medianCloud != null && stats.medianCloud > 60) return 'cloud';
  return null;
}

/**
 * Score one event. `scenes` are Sentinel-2 passes; `sarScenes` (optional) are
 * Sentinel-1 passes. Without SAR data the model reduces to optical-only.
 *
 * Demand D splits three ways (they sum to D, ±rounding):
 *   coverageGap   = D·(1 − S)       free missions have not looked (well) → tasking
 *   resolutionGap = D·S·v           looked, but the need is sub-metre → VHR
 *   serviceable   = D·S·(1 − v)     deliverable today from free data → analytics
 * with v = VHR_NEED[category]; opportunity = coverageGap + resolutionGap.
 * Classification stays on coverage S: it answers "can free data see it?".
 */
export function scoreEvent(event, scenes, nowMs = Date.now(), { sarScenes } = {}) {
  const demand = demandScore(event, nowMs);
  const stats = supplyStats(scenes, nowMs);
  const sar = sarScenes ? sarStats(sarScenes, nowMs) : null;
  const opticalSupply = stats.supply;
  const supply = sar ? combinedSupply(opticalSupply, sar.sarSupply, event.catId) : opticalSupply;
  const v = VHR_NEED[event.catId] ?? 0;
  const coverageGap = 100 * demand * (1 - supply);
  const resolutionGap = 100 * demand * supply * v;
  const serviceable = Math.round(100 * demand * supply * (1 - v)); // sellable off free data today
  return {
    ...event,
    ...stats,
    ...(sar ?? {}),
    opticalSupply: round3(opticalSupply),
    supply: round3(supply),
    demand: round1(100 * demand),
    coverageGap: Math.round(coverageGap),
    resolutionGap: Math.round(resolutionGap),
    opportunity: Math.round(coverageGap + resolutionGap), // commercial (paid-imagery) signal
    serviceable,
    cls: classify(supply),
    gapReason: gapReason(stats),
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const round1 = (x) => Math.round(x * 10) / 10;
const round3 = (x) => Math.round(x * 1000) / 1000;
