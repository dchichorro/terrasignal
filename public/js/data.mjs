// Data access with graceful degradation: live Node API when present, static
// snapshots on GitHub Pages; AOI scoring falls back to running the isomorphic
// core in the browser straight against the CORS-open Copernicus STAC.
import { scoreAoi } from '../core/aoi.mjs';
import { toLead, pipelineTotals } from '../core/value.mjs';

export const mode = { live: null }; // null until first probe

export async function loadRadar(region, days) {
  if (mode.live !== false) try {
    const live = await fetch(`api/radar?region=${region}&days=${days}`);
    if (live.ok) {
      mode.live = true;
      return await live.json();
    }
  } catch {
    /* static hosting: no live API */
  }
  mode.live = false;
  const snap = await fetch(`data/radar-${region}-${days}.json`);
  if (!snap.ok) throw new Error('no live API and no static snapshot');
  return upgrade(await snap.json());
}

/** Snapshots written before the commercial layer existed: derive lead fields client-side. */
function upgrade(radar) {
  if (radar.events.every((e) => e.recommendation)) return radar;
  radar.events = radar.events.map((e) => (e.recommendation ? e : toLead(e)));
  const p = pipelineTotals(radar.events);
  Object.assign(radar.kpis, { pipelineEUR: p.totalEUR, taskingPipelineEUR: p.taskingEUR, analyticsPipelineEUR: p.analyticsEUR });
  return radar;
}

export async function loadAoi({ lat, lng, radiusKm, days }) {
  if (mode.live !== false) {
    try {
      const r = await fetch(`api/aoi?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}&days=${days}`);
      if (r.ok) return await r.json();
      if (r.status === 400) throw new Error((await r.json()).error);
    } catch (e) {
      if (mode.live) throw e;
    }
  }
  return scoreAoi({ lat, lng, radiusKm, days }); // in-browser, same model as the server
}

export const feedUrl = (region) => (mode.live ? `feed.xml?region=${region}&days=45` : `data/feed-${region}.xml`);
