#!/usr/bin/env node
// Build the static GitHub Pages site.
//   --assets-only  copy the isomorphic core into public/core and stop (used by
//                  the Pages deploy; no network needed)
//   (default)      also precompute radar snapshots + lead exports in public/data/
// Snapshots are byte-identical when nothing material changed, so the hourly
// workflow only commits real changes.
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { buildRadar } from '../src/radar.mjs';
import { toCsv, toGeoJson, toAtom } from '../src/core/export.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const OUT = `${ROOT}public/data/`;
const SITE = process.env.SITE_URL ?? 'https://dchichorro.github.io/terrasignal/';

await rm(`${ROOT}public/core`, { recursive: true, force: true });
await cp(`${ROOT}src/core`, `${ROOT}public/core`, { recursive: true });
console.log('copied src/core → public/core');
if (process.argv.includes('--assets-only')) process.exit(0);

const asOf = new Date(Math.floor(Date.now() / (6 * 3_600_000)) * 6 * 3_600_000).toISOString();
await mkdir(OUT, { recursive: true });

// CelesTrak serves a group only once per update cycle (~3x/day); between cycles it
// returns a "has not updated" notice. Keep the previous bundle in that case — TLEs
// this fresh propagate accurately enough for markers and next-pass ETAs.
try {
  const tleText = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle').then((r) => r.text());
  const lines = tleText.split('\n').map((s) => s.trim()).filter(Boolean);
  const tles = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    if (lines[i].startsWith('SENTINEL') && /^1 /.test(lines[i + 1]) && /^2 /.test(lines[i + 2])) {
      tles.push({ name: lines[i], l1: lines[i + 1], l2: lines[i + 2] });
    }
  }
  if (tles.length) {
    await writeFile(`${OUT}tle.json`, JSON.stringify(tles));
    console.log(`wrote ${OUT}tle.json (${tles.length} sentinels)`);
  } else {
    console.log('celestrak: no fresh TLEs this cycle, keeping previous bundle');
  }
} catch (err) {
  console.log('celestrak fetch failed, keeping previous bundle:', err.message);
}

for (const region of ['eu', 'global']) {
  for (const days of [30, 45]) {
    const radar = await buildRadar({ region, days, focus: 30 });
    delete radar.generatedAt;
    radar.asOf = asOf;
    const base = `${OUT}radar-${region}-${days}`;
    await writeFile(`${base}.json`, JSON.stringify(radar));
    await writeFile(`${OUT}leads-${region}-${days}.csv`, toCsv(radar.events));
    await writeFile(`${OUT}leads-${region}-${days}.geojson`, JSON.stringify(toGeoJson(radar.events, { asOf, region: radar.region })));
    if (days === 45) {
      await writeFile(`${OUT}feed-${region}.xml`, toAtom(radar, { selfUrl: `${SITE}data/feed-${region}.xml`, siteUrl: SITE }));
    }
    const down = Object.entries(radar.feeds).filter(([, f]) => !f.ok).map(([id]) => id);
    console.log(`wrote ${base}.json (${radar.events.length} events, ${radar.kpis.gaps} gaps)${down.length ? ` — feeds down: ${down}` : ''}`);
  }
}
