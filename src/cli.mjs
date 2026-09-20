#!/usr/bin/env node
import { buildRadar } from './radar.mjs';

const args = parseArgs(process.argv.slice(2));
const useColor = !args['no-color'] && (process.stdout.isTTY === true || !!process.env.FORCE_COLOR);
const C = new Proxy({}, { get: (_, k) => (useColor ? codes[k] ?? '' : '') });
const codes = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', grey: '\x1b[90m', bold: '\x1b[1m', reset: '\x1b[0m' };

const radar = await buildRadar({ region: args.region ?? 'eu', days: Number(args.days ?? 45), focus: Number(args.focus ?? 30) });

if (args.json) {
  console.log(JSON.stringify(radar, null, 2));
  process.exit(0);
}

const k = radar.kpis;
const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'));
console.log(`${C.bold}TerraSignal — EO Demand Radar${C.reset}  ${C.grey}· ${radar.region} · events opened ≤ ${radar.days}d · ${radar.generatedAt}${C.reset}`);
console.log(C.grey + '─'.repeat(96) + C.reset);
console.log(
  ` Copernicus feed 24h: ${C.cyan}${fmt(k.scenes24h)}${C.reset} new S2-L2A scenes worldwide` +
    (k.euScenes24h != null ? `  ${C.grey}·${C.reset} ${C.cyan}${fmt(k.euScenes24h)}${C.reset} over Europe` : ''),
);
console.log(
  ` Demand unmet by free data: ${C.red}${k.unmetSharePct}%${C.reset} ${C.grey}(→ commercial tasking signal)${C.reset}  ` +
    `${C.grey}·${C.reset} ${C.red}${k.gaps} gaps${C.reset} / ${k.eventsAnalysed - k.gaps - k.ready} partial / ${C.green}${k.ready} ready now${C.reset}` +
    `  ${C.grey}(of ${k.eventsInScope} open events in scope)${C.reset}`,
);
console.log(C.grey + '─'.repeat(96) + C.reset);

for (const [i, e] of radar.events.entries()) {
  const gapCol = e.opportunity >= 45 ? C.red : e.opportunity >= 20 ? C.yellow : C.grey;
  const nowCol = e.serviceable >= 45 ? C.green : C.grey;
  console.log(
    `${C.bold}${String(i + 1).padStart(2)}${C.reset}  ` +
      `${gapCol}GAP ${bar(e.opportunity)} ${e.opportunity}${C.reset}   ${nowCol}NOW ${bar(e.serviceable)} ${e.serviceable}${C.reset}   ${classTag(e.cls)}  ` +
      `${C.bold}${trunc(e.title, 46)}${C.reset} ${C.grey}[${e.catId}${e.src === 'GDACS' ? ' · GDACS ' + (e.alertLevel ?? '') : ''}]${C.reset}`,
  );
  console.log(
    `     ${C.grey}${e.lastAgeDays != null ? `${e.count} pass${e.count === 1 ? '' : 'es'} · last ${e.lastAgeDays}d ago · cloud ${e.medianCloud}% · cadence ${e.cadenceDays != null ? e.cadenceDays + 'd' : '—'} · ${e.demand} demand · ${e.place || ''}` : 'no free-imagery coverage found · ' + e.demand + ' demand · ' + (e.place || '')}${C.reset}`,
  );
}

function classTag(cls) {
  if (cls === 'TASKING GAP') return `${C.red}${C.bold}⛔ TASKING-GAP${C.reset}`;
  if (cls === 'COPERNICUS-READY') return `${C.green}${C.bold}✔ COPERNICUS-READY${C.reset}`;
  return `${C.yellow}◑ PARTIAL${C.reset}    `;
}
function bar(v) {
  const filled = Math.round(v / 12.5);
  return '█'.repeat(filled) + '░'.repeat(8 - filled);
}
function trunc(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === '' ? true : m[2];
  }
  return out;
}
