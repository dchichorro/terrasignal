// Commercial layer: turn a scored event into a sales lead — which product fits,
// how big the area is, and an indicative deal value. Pure and isomorphic.
//
// PRICEBOOK values are ILLUSTRATIVE PLACEHOLDERS for demo purposes, not quotes.
// Replace them with your own reseller price book; every figure the UI shows is
// derived from this one table so calibration is a one-file change.
import { SAR_UTILITY, VHR_NEED } from './score.mjs';

export const PRICEBOOK = {
  currency: 'EUR',
  vhrOptical: { label: 'VHR optical tasking (30–50 cm)', perKm2: 25, minKm2: 100 },
  vhrDamage: { label: 'VHR damage assessment (30–50 cm tasking + grading)', perKm2: 35, minKm2: 100 },
  sarTasking: { label: 'Commercial SAR tasking (sub-metre, all-weather)', perScene: 3000, sceneKm2: 100 },
  freeSarAnalytics: { label: 'Sentinel-1 SAR analytics (free data)', perKm2: 6, minEur: 1500 },
  freeOpticalAnalytics: { label: 'Sentinel-2 analytics (free data)', perKm2: 5, minEur: 1500 },
};

// Typical area of interest per hazard, km radius around the event point.
export const DEFAULT_RADIUS_KM = {
  wildfires: 15,
  floods: 25,
  'severe-storms': 40,
  earthquake: 30,
  volcano: 15,
  landslide: 8,
  tsunami: 30,
  drought: 50,
  'oil-spill': 20,
  avalanche: 5,
  'manual-events': 10,
};

// hazards that come with persistent cloud, or that radar maps natively
const RADAR_NATIVE = new Set(['floods', 'oil-spill', 'severe-storms', 'sea-ice']);

export const aoiKm2 = (radiusKm) => Math.round(Math.PI * radiusKm * radiusKm);

/**
 * Pick the product that closes the gap. SAR wins when the optical shortfall is
 * cloud-driven (or hazard is radar-native) and free Sentinel-1 is not already enough.
 */
export function recommend(e, pb = PRICEBOOK) {
  const sarUseful = (SAR_UTILITY[e.catId] ?? 0.5) >= 0.7;
  if (e.cls === 'COPERNICUS-READY' && (VHR_NEED[e.catId] ?? 0) >= 0.5) {
    // free data sees it, but the buyer needs building-level detail
    return { key: 'vhrDamage', motion: 'tasking', ...pb.vhrDamage };
  }
  if (e.cls === 'COPERNICUS-READY') {
    const sarCarried = (e.opticalSupply ?? e.supply) < 0.65 && (e.sarSupply ?? 0) > 0.5;
    return sarCarried
      ? { key: 'freeSarAnalytics', motion: 'analytics', ...pb.freeSarAnalytics }
      : { key: 'freeOpticalAnalytics', motion: 'analytics', ...pb.freeOpticalAnalytics };
  }
  if (sarUseful && (e.gapReason === 'cloud' || RADAR_NATIVE.has(e.catId))) {
    return { key: 'sarTasking', motion: 'tasking', ...pb.sarTasking };
  }
  return { key: 'vhrOptical', motion: 'tasking', ...pb.vhrOptical };
}

/** List-price value of the recommended product for this AOI. */
export function dealSize(rec, km2) {
  switch (rec.key) {
    case 'vhrOptical':
    case 'vhrDamage':
      return Math.max(rec.minKm2, km2) * rec.perKm2;
    case 'sarTasking':
      return Math.ceil(km2 / rec.sceneKm2) * rec.perScene;
    default:
      return Math.max(rec.minEur, km2 * rec.perKm2);
  }
}

/**
 * Attach lead fields: radiusKm, areaKm2, recommendation, dealEUR and
 * weightedEUR (deal × the matching score share — a pipeline-weighting proxy).
 */
export function toLead(e, { pricebook = PRICEBOOK } = {}) {
  const radiusKm = e.radiusKm ?? DEFAULT_RADIUS_KM[e.catId] ?? 10;
  const areaKm2 = aoiKm2(radiusKm);
  const rec = recommend(e, pricebook);
  const dealEUR = Math.round(dealSize(rec, areaKm2));
  const weight = (rec.motion === 'tasking' ? e.opportunity : e.serviceable) / 100;
  return {
    ...e,
    radiusKm,
    areaKm2,
    recommendation: { key: rec.key, label: rec.label, motion: rec.motion },
    dealEUR,
    weightedEUR: Math.round(dealEUR * weight),
  };
}

export function pipelineTotals(leads) {
  let tasking = 0;
  let analytics = 0;
  for (const l of leads) {
    if (l.recommendation?.motion === 'tasking') tasking += l.weightedEUR ?? 0;
    else analytics += l.weightedEUR ?? 0;
  }
  return { taskingEUR: tasking, analyticsEUR: analytics, totalEUR: tasking + analytics };
}

export const fmtEUR = (n) =>
  n == null ? '—' : n >= 1e6 ? `€${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `€${Math.round(n / 1e3)}k` : `€${n}`;
