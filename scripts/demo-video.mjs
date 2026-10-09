#!/usr/bin/env node
// Record a narrated product demo of the running app (captions + visible cursor).
//   npm start                       # in another terminal (or BASE_URL=...)
//   npm run video -- [out.webm]
// Needs playwright-core's Chromium (npx playwright-core install chromium-headless-shell).
import { chromium } from 'playwright-core';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4660/';
const OUT = resolve(process.argv[2] ?? 'demo/terrasignal-demo.webm');
const W = 1280, H = 760;
const tmp = `${dirname(OUT)}/.rec`;
await mkdir(tmp, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmp, size: { width: W, height: H } } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin }).catch(() => {});

// overlay chrome injected into every page: caption bar, cursor, full-screen cards
await ctx.addInitScript(() => {
  const css = `
    #__cap { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 99999; max-width: 980px;
      background: rgba(6,10,18,.92); color: #fff; border: 1px solid #2f4166; border-radius: 12px; padding: 12px 20px;
      font: 600 19px/1.35 system-ui, sans-serif; text-align: center; box-shadow: 0 12px 40px #000a; transition: opacity .35s; }
    #__cap small { display: block; font: 400 14.5px/1.4 system-ui, sans-serif; color: #9fb0cc; margin-top: 3px; }
    #__cap.off { opacity: 0; }
    #__cur { position: fixed; z-index: 100000; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
      border: 2px solid #fff; background: rgba(86,200,255,.35); pointer-events: none; transition: transform .12s; }
    #__cur.down { transform: scale(.7); background: rgba(255,211,107,.6); }
    #__card { position: fixed; inset: 0; z-index: 99998; display: grid; place-items: center; background: radial-gradient(900px 500px at 70% 0%, #13284a, #0b0e14 70%);
      color: #dfe6f3; font-family: system-ui, sans-serif; transition: opacity .5s; }
    #__card .in { max-width: 920px; padding: 0 40px; }
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
    if (!t) return c.classList.add('off');
    c.innerHTML = t + (sub ? `<small>${sub}</small>` : '');
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
const wait = (ms) => page.waitForTimeout(ms);
const cap = (t, sub) => page.evaluate(([t, s]) => window.__cap(t, s), [t, sub]);
const card = (html) => page.evaluate((h) => window.__card(h), html);
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
const events = () => page.evaluate(() => window.terrasignal.state.radar.events.map((e) => ({ id: e.id, title: e.title, cls: e.cls, rec: e.recommendation.key, cat: e.catId, act: e.activation })));
const rowSel = (id) => `.row[data-key="${id.replace(/"/g, '\\"')}"]`;
const ready = () => page.waitForFunction(() => window.terrasignal?.state.radar && document.querySelector('.row[data-key]'), null, { timeout: 120000 });

// ---- 1. title card -------------------------------------------------------------
await page.goto(BASE, { waitUntil: 'networkidle' });
await card(`<h1>TerraSignal <span>v0.2</span></h1><p>From a demo radar to a sellable product: what changed while you were flying.</p>
  <ul><li><b>Business:</b> every disaster event is now a priced sales lead, with a landing page, pricing and exports</li>
  <li><b>Model:</b> Sentinel-1 radar supply, Copernicus EMS + USGS demand, and a VHR gap free data can't close</li>
  <li><b>Architecture:</b> one isomorphic core for server and browser, 40 offline tests, CI, and the fixed Pages pipeline</li></ul>`);
await wait(6500);
await card(null);
await wait(600);

// ---- 2. landing ----------------------------------------------------------------
await cap('New landing page: positioning for EO sales teams', 'live numbers come straight from the radar: weighted pipeline, commercial share, top leads');
await hover('#livePipeline');
await wait(4000);
await hover('#liveLeads .lead');
await wait(2000);
await cap('How it works, who it’s for, features', 'demand = coverage gap + VHR gap + free-serviceable, a transparent and unit-tested model');
await smoothScroll(760, 3000);
await wait(2600);
await smoothScroll(700, 2600);
await wait(2600);
await cap('Pricing: early-access plans', 'Explorer is free (top of funnel) · Pro at €490/mo per team · Enterprise for CRM sync and calibration');
await smoothScroll(900, 2600);
await wait(3800);
await smoothScroll(-10000, 1500);
await cap(null);
await wait(500);
await clickEl('.hero .btn.big');

// ---- 3. radar: global ----------------------------------------------------------
await page.waitForURL(/radar\.html/);
await page.evaluate(() => document.querySelector('#region button[data-v="global"]').click());
await ready();
await wait(1500);
await cap('Every event is now a priced lead', 'recommended product · indicative deal value · free-supply status for Sentinel-2 (optical) and Sentinel-1 (radar)');
await hover('.kpi.money');
await wait(3500);
await clickEl('#pbInfo');
await cap('One transparent price book drives every € figure', 'illustrative placeholders: swap in a reseller’s real list prices and this becomes their pipeline');
await wait(5000);
await clickEl('#modal .close');
await wait(500);

let evs = await events();
const gap = evs.find((e) => e.cls === 'TASKING GAP' && e.rec === 'vhrOptical') ?? evs[0];
await cap('Coverage gap → tasking lead', 'no free Sentinel-2 pass since the event: free data cannot serve it, so the lead is VHR optical tasking');
await clickEl(rowSel(gap.id));
await wait(5500);
const sar = evs.find((e) => e.rec === 'sarTasking');
if (sar) {
  await cap('Cloud-bound hazards → commercial SAR', 'cyclones and floods sit under cloud, so the recommendation switches to all-weather radar tasking');
  await clickEl(rowSel(sar.id));
  await wait(5500);
}
const dmg = evs.find((e) => e.rec === 'vhrDamage');
if (dmg) {
  await cap('“Covered” is not “no market”: the VHR gap', 'free 10 m pixels saw this quake, but building-damage grading needs sub-metre imagery (pink on the meter)');
  await clickEl(rowSel(dmg.id));
  await wait(5500);
}

// ---- 4. Europe + CEMS ----------------------------------------------------------
await page.keyboard.press('Escape');
await clickEl('#region button[data-v="eu"]');
await page.waitForFunction(() => window.terrasignal.state.radar?.region === 'Europe', null, { timeout: 120000 });
await wait(2000);
await cap('New demand feeds: Copernicus EMS activations + USGS', 'an EMS activation means the EU is already buying imagery there: confirmed, funded demand (dashed ring)');
await clickEl('#filters button[data-f="cems"]');
await wait(2500);
evs = await events();
const cems = evs.find((e) => e.act);
if (cems) { await clickEl(rowSel(cems.id)); await wait(5000); }
await clickEl('#filters button[data-f="all"]');
await wait(800);
const s1 = evs.find((e) => e.rec === 'freeSarAnalytics');
if (s1) {
  await cap('New supply: Sentinel-1 radar counts', 'a cloudy flood is not a gap when free SAR passed yesterday: it becomes an analytics-on-free-data lead');
  await clickEl(rowSel(s1.id));
  await wait(5500);
}

// ---- 5. sales workflow ---------------------------------------------------------
const anyLead = evs.find((e) => e.rec === 'vhrDamage') ?? evs[0];
await clickEl(rowSel(anyLead.id));
await wait(1800);
await cap('One-click sales brief', 'the shortfall, the offer, area, value and source links, ready for an email or a CRM note');
await clickEl('.leaflet-popup [data-act="brief"]');
const brief = await page.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch { return ''; } });
const briefText = brief || (await page.evaluate(async (id) => (await import('./core/export.mjs')).toBrief(window.terrasignal.state.radar.events.find((e) => e.id === id)), anyLead.id));
await page.evaluate((t) => window.__brief(t), briefText);
await wait(6500);
await page.evaluate(() => window.__brief(null));
await page.keyboard.press('Escape');
await page.evaluate(() => window.terrasignal.map.closePopup());

await cap('Score any area: drop a pin, set a radius', 'live Sentinel-1/2 supply in seconds; on the static site the same model runs in the browser');
await clickEl('#pinBtn');
await wait(600);
const mapBox = await page.locator('#map').boundingBox();
await page.evaluate(() => window.terrasignal.map.flyTo([39.47, -0.38], 8, { duration: 1.2 }));
await wait(1800);
await clickAt(mapBox.x + mapBox.width * 0.5, mapBox.y + mapBox.height * 0.55);
await page.waitForSelector('.row.custom[data-key]', { timeout: 60000 });
await wait(3500);
const slider = await page.locator('#radius').boundingBox();
await moveTo(slider.x + slider.width * 0.17, slider.y + slider.height / 2);
await page.mouse.down();
await moveTo(slider.x + slider.width * 0.5, slider.y + slider.height / 2, 30);
await page.mouse.up();
await cap('Radius change → re-scored live', 'pins, filters and the selected lead are all kept in the URL, so you can share exactly this view');
await page.waitForSelector('.row.custom[data-key]', { timeout: 60000 });
await wait(4500);

await cap('Export leads where sales teams work', 'CSV for the CRM · GeoJSON for QGIS/ArcGIS · Atom feed for Slack and Teams channels');
await clickEl('#exportBtn');
await wait(1500);
await hover('#exportMenu button[data-x="geojson"]');
await wait(1200);
await hover('#exportMenu button[data-x="feed"]');
await wait(1800);
await clickEl('#exportMenu button[data-x="csv"]');
await wait(2500);
await clickEl('#shareBtn');
await wait(2000);
await cap(null);

// ---- 6. under the hood + close -------------------------------------------------
await card(`<h1>Under the hood</h1>
  <ul><li><code>src/core/</code> is <b>isomorphic</b>: the same scoring, value and export modules run on the server, in the browser and in CI (test-enforced)</li>
  <li><b>Source registry</b>: one module per feed (CEMS, GDACS, USGS, EONET); a dead feed degrades gracefully and shows in the UI</li>
  <li><b>Dependency-injected</b> radar pipeline, single-flight cache, a handler factory with input validation, OpenAPI at <code>/api/openapi.json</code></li>
  <li><b>40 offline tests</b> (was 7) plus CI on Node 20/22</li>
  <li><b>Fixed:</b> GitHub Pages had silently stopped updating on 2026-09-20 (bot pushes don't trigger workflows), so it now redeploys after every data run</li></ul>`);
await wait(9000);
await card(`<h1>Find the imagery deals <span>free data can't close.</span></h1>
  <p>Branch <code>productize</code> · nothing pushed · see README, docs/product.md, docs/adr/</p>`);
await wait(4500);

const video = page.video();
await ctx.close();
await browser.close();
await mkdir(dirname(OUT), { recursive: true });
await rename(await video.path(), OUT);
await rm(tmp, { recursive: true, force: true });
console.log(`wrote ${OUT}`);
