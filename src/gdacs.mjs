import { fetchJson } from './http.mjs';

const FEED = 'https://www.gdacs.org/xml/rss.xml';
const TYPE_MAP = {
  WF: { catId: 'wildfires', weight: 1.0, label: 'Forest fire' },
  FL: { catId: 'floods', weight: 0.95, label: 'Flood' },
  TC: { catId: 'severe-storms', weight: 0.85, label: 'Tropical cyclone' },
  EQ: { catId: 'earthquake', weight: 0.85, label: 'Earthquake' },
  VO: { catId: 'volcano', weight: 0.9, label: 'Volcano' },
  TS: { catId: 'tsunami', weight: 0.9, label: 'Tsunami' },
  DR: { catId: 'drought', weight: 0.7, label: 'Drought' },
  LS: { catId: 'landslide', weight: 0.8, label: 'Landslide' },
  IdP: { catId: 'manual-events', weight: 0.6, label: 'Complex event' },
  AL: { catId: 'avalanche', weight: 0.7, label: 'Avalanche' },
};
const ALERT_PRIOR = { Red: 1.0, Orange: 0.8, Green: 0.5 };

function tag(block, name, ns = 'gdacs') {
  const urls = { gdacs: 'http://www.gdacs.org', georss: 'http://www.georss.org/georss' };
  const re = new RegExp(`<(${ns}:)?${name}[^>]*>([\\s\\S]*?)<\\/(?:${ns}:)?${name}>`);
  const m = block.match(re);
  return m ? m[2].trim() : null;
}

/** Fetch GDACS (EC/UN) global alerts and map onto the unified event shape. */
export async function fetchGdacsEvents({ bbox } = {}) {
  const text = await fetch(FEED, { signal: AbortSignal.timeout(20000) }).then((r) => {
    if (!r.ok) throw new Error(`GDACS HTTP ${r.status}`);
    return r.text();
  });
  const byEvent = new Map();
  for (const block of text.split('<item>').slice(1)) {
    const chunk = block.split('</item>')[0];
    const type = tag(chunk, 'eventtype');
    const mapped = TYPE_MAP[type];
    if (!mapped) continue;
    const pt = (tag(chunk, 'point', 'georss') ?? '').split(/\s+/).map(Number);
    if (pt.length < 2 || !pt.every(Number.isFinite)) continue;
    const [lat, lng] = pt;
    if (bbox && (lng < bbox[0] || lat < bbox[1] || lng > bbox[2] || lat > bbox[3])) continue;
    const country = decode(tag(chunk, 'country') ?? '');
    const from = Date.parse(tag(chunk, 'fromdate') ?? '');
    const pub = Date.parse(tag(chunk, 'pubDate') ?? '');
    // fromdate is occasionally ahead of pub (feed quirk); opening = earliest sane date
    const openedMs = [from, pub].filter(Number.isFinite).sort((a, b) => a - b)[0] ?? Date.now();
    const evt = {
      id: `GDACS_${tag(chunk, 'eventid')}_${tag(chunk, 'episodeid') ?? '1'}`,
      eventId: `GDACS_${tag(chunk, 'eventid')}`,
      title: mapped.label + (country ? `, ${country}` : ''),
      alertTitle: decode(tag(chunk, 'title')),
      place: country,
      catId: mapped.catId,
      prior: ALERT_PRIOR[tag(chunk, 'alertlevel')] ?? 0.5,
      openedISO: new Date(openedMs).toISOString(),
      latestISO: new Date(Number.isFinite(pub) ? pub : Date.now()).toISOString(),
      lng,
      lat,
      magnitudeValue: null,
      magnitudeUnit: null,
      alertLevel: tag(chunk, 'alertlevel'),
      src: 'GDACS',
      sources: [tag(chunk, 'link')].filter(Boolean),
    };
    const prev = byEvent.get(evt.eventId);
    if (!prev || Number(evt.id.split('_').pop()) > Number(prev.id.split('_').pop())) byEvent.set(evt.eventId, evt);
  }
  return [...byEvent.values()];
}

const decode = (s) =>
  (s ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
