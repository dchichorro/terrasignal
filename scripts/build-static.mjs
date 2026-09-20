#!/usr/bin/env node
// Precompute radar snapshots for the static GitHub Pages site.
// Writes public/data/radar-<region>-<days>.json; byte-identical output when
// nothing material changed, so the hourly workflow only commits real changes.
import { mkdir, writeFile } from 'node:fs/promises';
import { buildRadar } from '../src/radar.mjs';

const OUT = new URL('../public/data/', import.meta.url).pathname;
const asOf = new Date(Math.floor(Date.now() / (6 * 3_600_000)) * 6 * 3_600_000).toISOString();

await mkdir(OUT, { recursive: true });

// CelesTrak serves a group only once per update cycle (~3x/day); between cycles it
// returns a "has not updated" notice. Keep the previous bundle in that case — TLEs
// this fresh propagate accurately enough for markers and next-pass ETAs.
try {
  const tleText = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle')
    .then((r) => r.text());
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
    const file = `${OUT}radar-${region}-${days}.json`;
    await writeFile(file, JSON.stringify(radar));
    console.log(`wrote ${file} (${radar.events.length} events, ${radar.kpis.gaps} gaps)`);
  }
}
