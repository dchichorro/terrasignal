// Lead exports: CSV (CRM import), GeoJSON (GIS), Atom (Slack/Teams/RSS readers),
// and a plain-text sales brief. Pure and isomorphic.
import { fmtEUR } from './value.mjs';

const COLUMNS = [
  ['id', (e) => e.id],
  ['title', (e) => e.title],
  ['place', (e) => e.place],
  ['category', (e) => e.catId],
  ['source', (e) => [e.src, ...(e.mergedFrom ?? []).filter((s) => s !== e.src)].join('+')],
  ['cems_activation', (e) => e.activation ?? ''],
  ['lat', (e) => e.lat],
  ['lng', (e) => e.lng],
  ['opened', (e) => e.openedISO],
  ['classification', (e) => e.cls],
  ['gap_reason', (e) => e.gapReason ?? ''],
  ['demand', (e) => e.demand],
  ['opportunity', (e) => e.opportunity],
  ['serviceable', (e) => e.serviceable],
  ['s2_last_pass_days', (e) => e.lastAgeDays ?? ''],
  ['s2_median_cloud_pct', (e) => e.medianCloud ?? ''],
  ['s1_last_pass_days', (e) => e.sarLastAgeDays ?? ''],
  ['aoi_km2', (e) => e.areaKm2],
  ['recommended_product', (e) => e.recommendation?.label],
  ['indicative_deal_eur', (e) => e.dealEUR],
  ['weighted_eur', (e) => e.weightedEUR],
  ['link', (e) => e.sources?.[0] ?? ''],
];

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(events) {
  return [COLUMNS.map(([h]) => h).join(','), ...events.map((e) => COLUMNS.map(([, f]) => csvCell(f(e))).join(','))].join('\n') + '\n';
}

export function toGeoJson(events, meta = {}) {
  return {
    type: 'FeatureCollection',
    ...meta,
    features: events.map((e) => ({
      type: 'Feature',
      id: e.id,
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: Object.fromEntries(COLUMNS.filter(([h]) => h !== 'lat' && h !== 'lng').map(([h, f]) => [h, f(e)])),
    })),
  };
}

const REASON = {
  'no-pass': 'no Sentinel-2 pass in the event window',
  stale: 'latest free optical pass is stale',
  cloud: 'free optical passes are cloud-covered',
};

/** A sales-ready paragraph for an email or CRM note. */
export function toBrief(e) {
  const lines = [
    `${e.title} — ${e.cls}`,
    `${e.place ? e.place + ' · ' : ''}${e.catId} · opened ${e.openedISO?.slice(0, 10)}${e.activation ? ` · Copernicus EMS ${e.activation} active` : ''}`,
    `Demand ${e.demand}/100 · tasking gap ${e.opportunity} · serviceable from free data ${e.serviceable}`,
    `Free supply: Sentinel-2 ${e.lastAgeDays != null ? `last pass ${e.lastAgeDays} d ago, ${e.medianCloud ?? '—'}% cloud` : 'no pass'}` +
      `${e.sarLastAgeDays != null ? ` · Sentinel-1 last pass ${e.sarLastAgeDays} d ago` : ''}` +
      `${e.gapReason ? ` (${REASON[e.gapReason]})` : ''}`,
    `Recommended: ${e.recommendation?.label} over ~${e.areaKm2?.toLocaleString('en-US')} km² — indicative ${fmtEUR(e.dealEUR)}`,
    `Location: ${e.lat?.toFixed(4)}, ${e.lng?.toFixed(4)}${e.sources?.[0] ? ` · ${e.sources[0]}` : ''}`,
  ];
  return lines.join('\n');
}

const xml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

/** Leads worth a sales touch: any coverage gap, or a paid-imagery recommendation. */
export const isTaskingLead = (e) => e.cls !== 'COPERNICUS-READY' || e.recommendation?.motion === 'tasking';

/** Atom feed of tasking leads, highest weighted value first. */
export function toAtom(radar, { selfUrl = '', siteUrl = '' } = {}) {
  const updated = radar.generatedAt ?? radar.asOf ?? new Date().toISOString();
  const leads = radar.events.filter(isTaskingLead).sort((a, b) => (b.weightedEUR ?? 0) - (a.weightedEUR ?? 0));
  const entries = leads
    .map(
      (e) => `  <entry>
    <id>urn:terrasignal:${xml(e.id)}</id>
    <title>${xml(`[${e.cls}] ${e.title} — ${fmtEUR(e.dealEUR)} ${e.recommendation?.motion ?? ''}`)}</title>
    <updated>${xml(e.latestISO ?? e.openedISO)}</updated>
    <link href="${xml(`${siteUrl}radar.html#event=${encodeURIComponent(e.id)}`)}"/>
    <category term="${xml(e.catId)}"/>
    <content type="text">${xml(toBrief(e))}</content>
  </entry>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:terrasignal:leads:${xml(radar.region)}</id>
  <title>TerraSignal tasking leads — ${xml(radar.region)}</title>
  <updated>${xml(updated)}</updated>
  ${selfUrl ? `<link rel="self" href="${xml(selfUrl)}"/>` : ''}
  <author><name>TerraSignal</name></author>
${entries}
</feed>
`;
}
