#!/usr/bin/env node
// Record a narrated product demo of the running app (voice + captions + visible cursor).
//   npm start                       # in another terminal (or BASE_URL=...)
//   npm run video -- [out.mp4]      # H.264 + AAC; also writes a .srt next to it
// Needs playwright-core's Chromium (npx playwright-core install chromium-headless-shell), ffmpeg
// with libx264, and optionally Piper TTS for the voice (PIPER_PY=<venv python with piper-tts>,
// PIPER_VOICE=<.onnx>; defaults shared with satprint's video build). Without Piper the video is
// captions-only, paced by word count.
//
// The narration quotes the live radar: it is built from /api/radar before recording (which also
// warms the server cache, so the page shows the same numbers the voice reads out).
import { chromium } from 'playwright-core';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const BASE = process.env.BASE_URL ?? 'http://localhost:4660/';
const OUT = resolve(process.argv[2] ?? 'demo/terrasignal-demo.mp4');
const W = 1280, H = 760;
const tmp = `${dirname(OUT)}/.rec`;
const VOICE_HOME = join(homedir(), '.local/share/satprint-video');
const PIPER_PY = process.env.PIPER_PY ?? join(VOICE_HOME, 'venv/bin/python');
const PIPER_VOICE = process.env.PIPER_VOICE ?? join(VOICE_HOME, 'en_US-ryan-high.onnx');
await mkdir(tmp, { recursive: true });

// ---- live numbers ----------------------------------------------------------------
const api = (region) => fetch(new URL(`api/radar?region=${region}&days=45`, BASE)).then((r) => r.json());
const [glob, eu] = await Promise.all([api('global'), api('eu')]);
const pick = (evs, f) => evs.find(f) ?? null;
const gap = pick(glob.events, (e) => e.cls === 'TASKING GAP' && e.recommendation.key === 'vhrOptical') ?? glob.events[0];
const sar = pick(glob.events, (e) => e.recommendation.key === 'sarTasking');
const dmg = pick(glob.events, (e) => e.recommendation.key === 'vhrDamage');
const cems = pick(eu.events, (e) => e.activation);
const s1 = pick(eu.events, (e) => e.recommendation.key === 'freeSarAnalytics');
const tests = Number(execFileSync(process.execPath, ['--test', ...readdirSync(`${ROOT}test`).filter((f) => f.endsWith('.test.mjs')).map((f) => `test/${f}`)],
  { cwd: ROOT, encoding: 'utf8' }).match(/^# pass (\d+)/m)?.[1]);
const eur = (n) => (n >= 1e6 ? `€${(n / 1e6).toFixed(1)}M` : `€${Math.round(n / 1000)}k`);
const K = glob.kpis;
// 'Earthquake, Fiji' → 'earthquake in Fiji', for use mid-sentence
const named = (e) => (/ in /.test(e.title) ? e.title : e.title.replace(', ', ' in ')).replace(/^./, (c) => c.toLowerCase());

// ---- narration (caption text; speech() adapts it for the voice) ------------------
// each block: a caption headline + the sentences spoken (and shown) under it
const SCRIPT = {
  intro: ['', [
    `This is TerraSignal: a live lead radar for Earth-observation sales teams.`,
    `Copernicus gives away petabytes of free imagery. The EO market makes its money around that supply: tasking where free data can't deliver, and analytics where it can.`,
    `TerraSignal watches disaster demand and satellite supply together, and puts a price on the gap.`,
  ]],
  landing: ['The landing page, for EO sales teams', [
    `The landing page pitches it to sales teams, with live numbers straight from the radar: the weighted pipeline, and today's top leads.`,
  ]],
  how: ['How it works, who it’s for, features', [
    `Underneath is a transparent, unit-tested model. Demand splits into a coverage gap, a very-high-resolution gap, and what free data can already serve.`,
  ]],
  pricing: ['Pricing: early-access plans', [
    `The plans are early-access proposals: a free Explorer tier, Pro at 490 euros a month per team, and Enterprise for CRM sync and a calibrated model.`,
  ]],
  kpi: ['Every event is a priced lead', [
    `On the live radar, every disaster event becomes a priced sales lead. Globally, that's an indicative weighted pipeline of ${eur(K.pipelineEUR)} across ${K.eventsAnalysed} events.`,
    `${K.commercialSharePct} percent of the demand needs paid imagery.`,
  ]],
  prices: ['One transparent price book', [
    `Every euro figure comes from one transparent price book. The prices are illustrative: swap in a reseller's real list prices, and this becomes their pipeline.`,
  ]],
  gap: ['Coverage gap → tasking lead', [
    `Take this ${named(gap)}. No Sentinel-2 pass since the event, so free data can't serve it.`,
    `The lead is VHR optical tasking, worth about ${eur(gap.dealEUR)}.`,
  ]],
  sar: sar && ['Cloud-bound hazards → commercial SAR', [
    `This ${named(sar)} sits under cloud, so the recommendation switches to all-weather commercial SAR tasking.`,
  ]],
  dmg: dmg && ['“Covered” is not “no market”: the VHR gap', [
    `And this ${named(dmg)}: free 10 metre Copernicus data covers it, but grading building damage needs sub-metre pixels.`,
    `That's the VHR gap, the pink on the meter. Free data can never close it.`,
  ]],
  cems: ['Copernicus EMS activations: confirmed demand', [
    `Switch to Europe. A Copernicus Emergency Management activation means the EU is already buying imagery there: confirmed, funded demand.`,
    ...(cems ? [`Right now that includes this ${named(cems)}.`] : []),
  ]],
  s1: s1 && ['Sentinel-1 radar counts as supply', [
    `A cloudy ${named(s1)} is not a gap: Sentinel-1 radar passed recently, so it becomes an analytics lead on free data.`,
  ]],
  brief: ['One-click sales brief', [
    `One click copies a sales brief: the shortfall, the offer, the area, the value and the source links, ready for an email or a CRM note.`,
  ]],
  pin: ['Score any area: drop a pin, set a radius', [
    `Score any area: drop a pin, and live Sentinel-1 and Sentinel-2 supply is scored in seconds. On the static site, the same model runs in the browser.`,
  ]],
  radius: ['Radius change → re-scored live', [
    `Drag the radius and it re-scores live. Pins, filters and the selected lead are all kept in the URL, so you can share exactly this view.`,
  ]],
  export: ['Export leads where sales teams work', [
    `And export leads where sales teams already work: CSV for the CRM, GeoJSON for GIS, and an Atom feed for Slack or Teams.`,
  ]],
  hood: ['', [
    `Under the hood, one isomorphic core runs the same scoring, value and export code on the server, in the browser, and in CI.`,
    `Each feed is its own module: Copernicus EMS, GDACS, USGS and NASA EONET. A dead feed degrades gracefully, and the UI says so.`,
    `${tests} offline tests run in CI on Node 20 and 22, and the static site is rebuilt from fresh data every hour.`,
    `The honest caveat: the price book and the demand priors are heuristics, to be calibrated with design partners.`,
  ]],
  close: ['', [
    `The gap between what disasters ask for and what Copernicus delivers is the market. TerraSignal measures that gap live, and prices it.`,
  ]],
};

const spokenEUR = (s) => s.replace(/€([\d.]+)M/g, '$1 million euros').replace(/€(\d+)k/g, '$1 thousand euros');
const speech = (s) => spokenEUR(s)
  .replace(/Sentinel-([12])/g, 'Sentinel $1').replace(/\bVHR\b/g, 'V H R').replace(/\bEO\b/g, 'E O').replace(/\bEU\b/g, 'E U')
  .replace(/\bCRM\b/g, 'C R M').replace(/\bCSV\b/g, 'C S V').replace(/GeoJSON/g, 'Geo Jason').replace(/\bGIS\b/g, 'G I S')
  .replace(/\bCI\b/g, 'C I').replace(/\bUSGS\b/g, 'U S G S').replace(/\bEMS\b/g, 'E M S').replace(/\bSAR\b/g, 'sar')
  .replace(/\b([A-Z])([A-Z]{2,})-\d+\b/g, (_, a, b) => a + b.toLowerCase()).replace(/\bGDACS\b/g, 'G-dacks').replace(/\bEONET\b/g, 'Eonet').replace(/\bNASA\b/g, 'Nasa');

// ---- narration audio ---------------------------------------------------------------
function wavInfo(buf) {
  let off = 12, fmt = null;
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { rate: buf.readUInt32LE(off + 12) };
    if (id === 'data') return { ...fmt, pcm: buf.subarray(off + 8, off + 8 + size) };
    off += 8 + size + (size & 1);
  }
  throw new Error('no data chunk');
}

async function synthesize() {
  const ttsDir = `${tmp}/../.tts`;
  await mkdir(ttsDir, { recursive: true });
  const lines = Object.values(SCRIPT).filter(Boolean).flatMap(([, l]) => l);
  const haveVoice = existsSync(PIPER_PY) && existsSync(PIPER_VOICE);
  if (!haveVoice) console.warn(`! no Piper voice (${PIPER_VOICE}): captions only`);
  const file = (text) => join(ttsDir, createHash('sha1').update(PIPER_VOICE + '\0' + speech(text)).digest('hex').slice(0, 16) + '.wav');
  const jobs = haveVoice ? lines.filter((t) => !existsSync(file(t))).map((t) => ({ text: speech(t), out: file(t) })) : [];
  if (jobs.length) {
    console.log(`· synthesising ${jobs.length} narration lines…`);
    execFileSync(PIPER_PY, ['-I', `${ROOT}scripts/tts.py`, PIPER_VOICE, '1.0'], { input: JSON.stringify(jobs), stdio: ['pipe', 'ignore', 'inherit'] });
  }
  const meta = new Map();
  for (const text of lines) {
    if (!haveVoice) { meta.set(text, { dur: Math.max(2.2, text.split(/\s+/).length / 2.6) }); continue; }
    const w = wavInfo(await readFile(file(text)));
    meta.set(text, { ...w, dur: w.pcm.length / 2 / w.rate });
  }
  return meta;
}

function mixWav(cues, end) {
  const voiced = cues.filter((c) => c.pcm);
  if (!voiced.length) return null;
  const rate = voiced[0].rate;
  const mix = new Int16Array(Math.ceil((end + 1) * rate));
  for (const c of voiced) {
    const src = new Int16Array(c.pcm.buffer, c.pcm.byteOffset, c.pcm.length >> 1);
    const at = Math.round(c.at * rate);
    for (let i = 0; i < src.length && at + i < mix.length; i++) mix[at + i] = Math.max(-32768, Math.min(32767, mix[at + i] + src[i]));
  }
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + mix.byteLength, 4); hdr.write('WAVEfmt ', 8);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(rate, 24);
  hdr.writeUInt32LE(rate * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(mix.byteLength, 40);
  return Buffer.concat([hdr, Buffer.from(mix.buffer)]);
}

const meta = await synthesize();

// ---- browser + overlay -------------------------------------------------------------
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmp, size: { width: W, height: H } } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin }).catch(() => {});

// overlay chrome injected into every page: caption bar, cursor, full-screen cards
await ctx.addInitScript(() => {
  const css = `
    #__cap { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 99999; width: max-content; max-width: 1000px;
      background: rgba(6,10,18,.92); color: #fff; border: 1px solid #2f4166; border-radius: 12px; padding: 12px 20px;
      font: 600 19px/1.35 system-ui, sans-serif; text-align: center; box-shadow: 0 12px 40px #000a; transition: opacity .35s; }
    #__cap small { display: block; font: 400 15.5px/1.4 system-ui, sans-serif; color: #c9d4e6; margin-top: 3px; }
    #__cap.bare small { margin: 0; font-size: 17px; color: #fff; }
    #__cap.off { opacity: 0; }
    #__cur { position: fixed; z-index: 100000; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
      border: 2px solid #fff; background: rgba(86,200,255,.35); pointer-events: none; transition: transform .12s; }
    #__cur.down { transform: scale(.7); background: rgba(255,211,107,.6); }
    #__card { position: fixed; inset: 0; z-index: 99998; display: grid; place-items: center; background: radial-gradient(900px 500px at 70% 0%, #13284a, #0b0e14 70%);
      color: #dfe6f3; font-family: system-ui, sans-serif; transition: opacity .5s; }
    #__card .in { max-width: 920px; padding: 0 40px 90px; }
    #__card h1 { font-size: 46px; margin: 0 0 12px; letter-spacing: -1px; } #__card h1 span { color: #56c8ff; }
    #__card p { font-size: 19px; color: #aab4c7; margin: 0 0 8px; }
    #__card ul { font-size: 18px; line-height: 1.65; color: #c9d2e3; padding-left: 22px; }
    #__card b { color: #ffd36b; } #__card code { color: #3ddc97; }
    #__brief { position: fixed; right: 24px; top: 70px; width: 470px; z-index: 99997; background: #0f1522; border: 1px solid #1f5a80; border-radius: 12px;
      padding: 14px 16px; color: #dfe6f3; font: 13px/1.5 ui-monospace, monospace; white-space: pre-wrap; box-shadow: 0 20px 50px #000c; }
    #__brief h4 { margin: 0 0 8px; font: 600 12px system-ui; letter-spacing: 1.5px; text-transform: uppercase; color: #56c8ff; }`;
  addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style'); s.textContent = css; document.head.append(s);
    const cur = Object.assign(document.createElement('div'), { id: '__cur' }); document.body.append(cur);
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => cur.classList.add('down'), true);
    addEventListener('mouseup', () => cur.classList.remove('down'), true);
  });
  window.__cap = (t, sub) => {
    let c = document.getElementById('__cap');
    if (!c) { c = Object.assign(document.createElement('div'), { id: '__cap' }); document.body.append(c); }
    if (!t && !sub) return c.classList.add('off');
    c.innerHTML = (t || '') + (sub ? `<small>${sub}</small>` : '');
    c.classList.toggle('bare', !t);
    c.classList.remove('off');
  };
  window.__card = (html) => {
    let c = document.getElementById('__card');
    if (!html) { if (c) { c.style.opacity = 0; setTimeout(() => c.remove(), 500); } return; }
    if (!c) { c = Object.assign(document.createElement('div'), { id: '__card' }); document.body.append(c); }
    c.innerHTML = `<div class="in">${html}</div>`;
  };
  window.__brief = (text) => {
    document.getElementById('__brief')?.remove();
    if (!text) return;
    const b = Object.assign(document.createElement('div'), { id: '__brief' });
    b.innerHTML = '<h4>Clipboard · sales brief</h4>';
    b.append(document.createTextNode(text));
    document.body.append(b);
  };
});

const page = await ctx.newPage();
let t0; // performance.now() at the first frame of the output video; cue times are relative to it
const wait = (ms) => page.waitForTimeout(ms);
const cap = (t, sub) => page.evaluate(([t, s]) => window.__cap(t, s), [t, sub]);
const card = (html) => page.evaluate((h) => window.__card(h), html);
const cues = [];

// say(): narrate one script block sentence by sentence; hooks[i] start as sentence i starts and
// are awaited before the block ends, so the choreography never outruns the voice (or vice versa)
async function say(id, hooks = {}) {
  if (!SCRIPT[id]) return;
  const [head, lines] = SCRIPT[id];
  const running = [];
  for (let i = 0; i < lines.length; i++) {
    const m = meta.get(lines[i]);
    await cap(head, lines[i]);
    cues.push({ at: (performance.now() - t0) / 1000, ...m, text: lines[i] });
    const t = performance.now();
    if (hooks[i]) running.push(hooks[i]());
    await Promise.all(running.splice(0));
    await wait(Math.max(0, m.dur * 1000 + 300 - (performance.now() - t)));
  }
}

let mouse = { x: W / 2, y: H / 2 };
async function moveTo(x, y, steps = 25) { await page.mouse.move(x, y, { steps }); mouse = { x, y }; }
async function clickAt(x, y) { await moveTo(x, y); await wait(250); await page.mouse.down(); await wait(90); await page.mouse.up(); }
async function clickEl(sel) {
  const loc = page.locator(sel).first();
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await clickAt(b.x + Math.min(b.width / 2, 160), b.y + b.height / 2);
}
async function hover(sel) { const b = await page.locator(sel).first().boundingBox(); await moveTo(b.x + b.width / 2, b.y + b.height / 2); }
async function smoothScroll(px, ms = 2500) {
  await page.evaluate(([px, ms]) => new Promise((r) => {
    const y0 = scrollY, t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); scrollTo(0, y0 + px * (0.5 - Math.cos(Math.PI * k) / 2)); k < 1 ? requestAnimationFrame(step) : r(); };
    requestAnimationFrame(step);
  }), [px, ms]);
}
const rowSel = (id) => `.row[data-key="${id.replace(/"/g, '\\"')}"]`;
const ready = () => page.waitForFunction(() => window.terrasignal?.state.radar && document.querySelector('.row[data-key]'), null, { timeout: 120000 });
// the page shares the server cache with the API calls above, but fall back to the first row if
// an event has rolled off the list in between
const openLead = async (e) => clickEl((await page.locator(rowSel(e.id)).count()) ? rowSel(e.id) : '.row[data-key]');

// ---- 0. sync marker ------------------------------------------------------------
// Playwright's recording starts at an unknown moment around newPage(). Flash black → white at a
// known clock time, find that cut in the raw video afterwards, and trim so voice and picture line up.
await page.setContent('<body style="margin:0;height:100vh;background:#000"></body>');
await wait(1000);
const flashAt = performance.now();
await page.evaluate(() => { document.body.style.background = '#fff'; });
await wait(300);

// ---- 1. title card -------------------------------------------------------------
await page.goto(BASE, { waitUntil: 'networkidle' });
await card(`<h1>TerraSignal</h1><p>A live lead radar for EO sales: where disasters need imagery that free Copernicus data can’t deliver.</p>
  <ul><li><b>Demand:</b> live disasters from Copernicus EMS, GDACS, USGS and NASA EONET</li>
  <li><b>Supply:</b> every Sentinel-2 optical and Sentinel-1 radar pass over each event</li>
  <li><b>The gap, priced:</b> each event becomes a sales lead with a recommended product and a € value</li></ul>`);
t0 = performance.now();
await wait(800);
await say('intro');
await card(null);
await wait(600);

// ---- 2. landing ----------------------------------------------------------------
await say('landing', { 0: async () => { await hover('#livePipeline'); await wait(2500); await hover('#liveLeads .lead'); } });
await say('how', { 0: async () => { await smoothScroll(760, 3000); await wait(1500); await smoothScroll(700, 2600); } });
await say('pricing', { 0: () => smoothScroll(900, 2600) });
await cap(null);
await smoothScroll(-10000, 1500);
await wait(400);
await clickEl('.hero .btn.big');

// ---- 3. radar: global ----------------------------------------------------------
await page.waitForURL(/radar\.html/);
await page.evaluate(() => document.querySelector('#region button[data-v="global"]').click());
await ready();
await wait(1200);
await say('kpi', { 0: () => hover('.kpi.money') });
await say('prices', { 0: () => clickEl('#pbInfo') });
await clickEl('#modal .close');
await wait(400);
await say('gap', { 0: () => openLead(gap) });
if (sar) await say('sar', { 0: () => openLead(sar) });
if (dmg) await say('dmg', { 0: () => openLead(dmg) });

// ---- 4. Europe + CEMS ----------------------------------------------------------
await page.keyboard.press('Escape');
await say('cems', {
  0: async () => {
    await clickEl('#region button[data-v="eu"]');
    await page.waitForFunction(() => window.terrasignal.state.radar?.region === 'Europe', null, { timeout: 120000 });
    await wait(1200);
    await clickEl('#filters button[data-f="cems"]');
  },
  1: () => cems && openLead(cems),
});
await clickEl('#filters button[data-f="all"]');
await wait(600);
if (s1) await say('s1', { 0: () => openLead(s1) });

// ---- 5. sales workflow ---------------------------------------------------------
const anyLead = s1 ?? cems ?? eu.events[0];
await openLead(anyLead);
await wait(1200);
await say('brief', {
  0: async () => {
    await clickEl('.leaflet-popup [data-act="brief"]');
    const brief = await page.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch { return ''; } });
    const text = brief || (await page.evaluate(async (id) => (await import('./core/export.mjs')).toBrief(window.terrasignal.state.radar.events.find((e) => e.id === id)), anyLead.id));
    await page.evaluate((t) => window.__brief(t), text);
  },
});
await wait(1200);
await page.evaluate(() => window.__brief(null));
await page.keyboard.press('Escape');
await page.evaluate(() => window.terrasignal.map.closePopup());

await say('pin', {
  0: async () => {
    await clickEl('#pinBtn');
    await wait(600);
    const mapBox = await page.locator('#map').boundingBox();
    await page.evaluate(() => window.terrasignal.map.flyTo([39.47, -0.38], 8, { duration: 1.2 }));
    await wait(1800);
    await clickAt(mapBox.x + mapBox.width * 0.5, mapBox.y + mapBox.height * 0.55);
    await page.waitForSelector('.row.custom[data-key]', { timeout: 60000 });
  },
});
await say('radius', {
  0: async () => {
    const slider = await page.locator('#radius').boundingBox();
    await moveTo(slider.x + slider.width * 0.17, slider.y + slider.height / 2);
    await page.mouse.down();
    await moveTo(slider.x + slider.width * 0.5, slider.y + slider.height / 2, 30);
    await page.mouse.up();
    await page.waitForSelector('.row.custom[data-key]', { timeout: 60000 });
  },
});
await say('export', {
  0: async () => {
    await clickEl('#exportBtn');
    await wait(1200);
    await hover('#exportMenu button[data-x="csv"]');
    await wait(1500);
    await hover('#exportMenu button[data-x="geojson"]');
    await wait(1500);
    await hover('#exportMenu button[data-x="feed"]');
  },
});
await page.keyboard.press('Escape');
await cap(null);

// ---- 6. under the hood + close -------------------------------------------------
await card(`<h1>Under the hood</h1>
  <ul><li><code>src/core/</code> is <b>isomorphic</b>: the same scoring, value and export modules run on the server, in the browser and in CI (test-enforced)</li>
  <li><b>Source registry</b>: one module per feed (CEMS, GDACS, USGS, EONET); a dead feed degrades gracefully and shows in the UI</li>
  <li><b>${tests} offline tests</b> in CI on Node 20/22 · static GitHub Pages site rebuilt hourly from fresh data</li>
  <li><b>Honest limits:</b> price book, VHR need and demand priors are heuristics to calibrate with design partners</li></ul>`);
await wait(800);
await say('hood');
await card(`<h1>Find the imagery deals <span>free data can't close.</span></h1>
  <p>Live at <code>dchichorro.github.io/terrasignal</code> · see README, docs/product.md, docs/adr/</p>`);
await wait(800);
await say('close');
await cap(null);
await wait(2000);

// ---- assembly: browser video + narration → mp4 (+ srt) -------------------------
const end = (performance.now() - t0) / 1000;
const video = page.video();
await ctx.close();
await browser.close();
const raw = await video.path();
await mkdir(dirname(OUT), { recursive: true });
const { stderr } = spawnSync('ffmpeg', ['-hide_banner', '-t', '10', '-i', raw, '-vf', 'blackdetect=d=0.3:pix_th=0.1', '-an', '-f', 'null', '-'], { encoding: 'utf8' });
const flashV = Number(stderr.match(/black_end:\s*([\d.]+)/)?.[1]);
if (!Number.isFinite(flashV)) throw new Error('sync flash not found in the recording');
const start = flashV + (t0 - flashAt) / 1000; // raw-video time of t0

const ts = (s) => new Date(Math.round(s * 1000)).toISOString().slice(11, 23).replace('.', ',');
await writeFile(OUT.replace(/\.\w+$/, '.srt'), cues.map((c, i) => `${i + 1}\n${ts(c.at)} --> ${ts(c.at + c.dur + 0.25)}\n${c.text}\n`).join('\n'));
const wav = mixWav(cues, end);
if (wav) await writeFile(`${tmp}/narration.wav`, wav);
console.log(`· encoding ${end.toFixed(1)} s (from ${start.toFixed(2)} s of the raw capture) → ${OUT}`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-ss', start.toFixed(3), '-i', raw, ...(wav ? ['-i', `${tmp}/narration.wav`] : []),
  '-c:v', 'libx264', '-preset', process.env.X264_PRESET ?? 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
  ...(wav ? ['-c:a', 'aac', '-b:a', '160k', '-af', 'loudnorm=I=-16:TP=-1.5'] : []), '-t', end.toFixed(2), '-movflags', '+faststart', OUT], { stdio: 'inherit' });
await rm(tmp, { recursive: true, force: true });
console.log(`wrote ${OUT}`);
