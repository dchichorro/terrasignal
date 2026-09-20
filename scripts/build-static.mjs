#!/usr/bin/env node
// Precompute radar snapshots for the static GitHub Pages site.
// Writes public/data/radar-<region>-<days>.json; byte-identical output when
// nothing material changed, so the hourly workflow only commits real changes.
import { mkdir, writeFile } from 'node:fs/promises';
import { buildRadar } from '../src/radar.mjs';

const OUT = new URL('../public/data/', import.meta.url).pathname;
const asOf = new Date(Math.floor(Date.now() / (6 * 3_600_000)) * 6 * 3_600_000).toISOString();

await mkdir(OUT, { recursive: true });
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
