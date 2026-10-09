// TerraSignal radar dashboard. Map + ranked lead list + lead detail, with
// shareable deep links. Exports are generated client-side from the same core
// the server uses, so they work on static hosting too.
import { loadRadar, loadAoi, feedUrl, mode } from './data.mjs';
import { startConstellation, nextS2Pass } from './sats.mjs';
import { toCsv, toGeoJson, toBrief } from '../core/export.mjs';
import { fmtEUR, PRICEBOOK } from '../core/value.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'));
const VIEWS = { eu: { center: [48, 12], zoom: 4 }, global: { center: [22, 5], zoom: 2 } };
const COLORS = { 'TASKING GAP': '#ff5d6c', PARTIAL: '#ffb454', 'COPERNICUS-READY': '#3ddc97' };
const CLS_KEY = { 'TASKING GAP': 'gap', PARTIAL: 'partial', 'COPERNICUS-READY': 'ready' };
const RES_COLOR = '#ff7ad9';
const PIN_COLOR = '#c58aff';
const ICON = {
  copy: '<svg class="ico" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  link: '<svg class="ico" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  info: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
};
const REASON = { 'no-pass': 'no Sentinel-2 pass in window', stale: 'free optical data is stale', cloud: 'free optical passes are cloudy' };

// --- state + deep links -----------------------------------------------------
const state = { region: 'eu', days: 45, filter: 'all', radar: null, selectedId: null, custom: null, customLoading: false, pin: null, pinMode: false, radiusKm: 10 };

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (VIEWS[h.get('region')]) state.region = h.get('region');
  if (['30', '45'].includes(h.get('days'))) state.days = Number(h.get('days'));
  if (['all', 'gap', 'partial', 'ready', 'cems'].includes(h.get('filter'))) state.filter = h.get('filter');
  state.selectedId = h.get('event');
  const pin = h.get('pin')?.split(',').map(Number);
  if (pin?.length === 3 && pin.every(Number.isFinite)) {
    state.pin = { lat: pin[0], lng: pin[1] };
    state.radiusKm = Math.min(50, Math.max(2, pin[2]));
  }
}

function writeHash() {
  const h = new URLSearchParams({ region: state.region, days: state.days });
  if (state.filter !== 'all') h.set('filter', state.filter);
  if (state.selectedId && state.selectedId !== 'custom') h.set('event', state.selectedId);
  if (state.pin) h.set('pin', `${state.pin.lat},${state.pin.lng},${state.radiusKm}`);
  history.replaceState(null, '', '#' + h);
}

// --- map --------------------------------------------------------------------
const map = L.map('map', { zoomControl: false, worldCopyJump: true });
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri — Earth, GEBCO, NOAA · data: Copernicus EMS, GDACS (EC JRC/UN), USGS, NASA EONET, ESA Copernicus Sentinel-1/2 via Element 84',
  maxZoom: 17,
}).addTo(map);
const markers = L.layerGroup().addTo(map);
const footprints = L.layerGroup().addTo(map);
const pinLayer = L.layerGroup().addTo(map);
let selMarker = null;
let pinMarker = null;
let aoiCircle = null;

// --- radar ------------------------------------------------------------------
async function fetchRadar() {
  $('#list').innerHTML = '<div class="skeleton">scanning Copernicus catalogue…</div>';
  try {
    state.radar = await loadRadar(state.region, state.days);
    hideErr();
    render();
    const pre = state.radar.events.find((e) => e.id === state.selectedId);
    if (pre) select(pre);
  } catch (e) {
    showErr('radar scan failed: ' + e.message);
  }
}

const visible = (events) =>
  events.filter((e) => (state.filter === 'all' ? true : state.filter === 'cems' ? e.activation : CLS_KEY[e.cls] === state.filter));

function meter(e) {
  const cov = e.coverageGap ?? e.opportunity;
  const res = e.resolutionGap ?? 0;
  return `<div class="meter" title="red: no usable free coverage · pink: needs sub-metre VHR · green: serviceable from free data">
    <i style="width:${cov}%;background:var(--red)"></i>
    <i style="left:${cov}%;width:${res}%;background:${RES_COLOR}"></i>
    <i style="left:${cov + res}%;width:${e.serviceable}%;background:var(--green)"></i></div>`;
}

function rowHtml(e, key, rank) {
  const cls = e.custom ? 'custom' : CLS_KEY[e.cls];
  const badge = e.custom ? `<span class="badge custom">CUSTOM AOI</span>` : `<span class="badge ${cls}">${e.cls}</span>`;
  const srcs = [...new Set([e.src, ...(e.mergedFrom ?? [])])].map((s) => `<i class="src">${esc(s)}</i>`).join('');
  return `<div class="row${e.custom ? ' custom' : ''}${state.selectedId === key ? ' sel' : ''}" data-key="${esc(key)}">
    <div class="top"><span class="rank">${rank}</span><span class="title">${esc(e.title)}</span>${badge}</div>
    <div class="deal"><b>${fmtEUR(e.dealEUR)}</b> <span>${esc(e.recommendation?.label ?? '')}</span></div>
    <div class="metrics"><span>commercial <b style="color:${e.custom ? PIN_COLOR : COLORS[e.cls]}">${e.opportunity}</b></span>
      <span>S2 <b>${e.lastAgeDays != null ? e.lastAgeDays + 'd' : 'none'}</b>${e.medianCloud != null ? ` · ${Math.round(e.medianCloud)}%☁` : ''}</span>
      <span>S1 <b>${e.sarLastAgeDays != null ? e.sarLastAgeDays + 'd' : '—'}</b></span>
      <span>demand <b>${e.demand}</b></span>${e.activation ? `<span class="ems">${esc(e.activation)}</span>` : ''}<span class="srcs">${srcs}</span></div>
    ${meter(e)}
  </div>`;
}

function render() {
  const customRow = state.custom
    ? rowHtml(state.custom, 'custom', '◆')
    : state.customLoading
      ? `<div class="row custom"><div class="top"><span class="rank">◆</span><span class="title">Scoring custom AOI · r ${state.radiusKm} km…</span><span class="badge custom">CUSTOM AOI</span></div><div class="metrics"><span class="pin-note">querying Sentinel-1/2 catalogue…</span></div></div>`
      : '';
  if (!state.radar) {
    $('#list').innerHTML = customRow + '<div class="skeleton">scanning Copernicus catalogue…</div>';
    bindRows([]);
    return;
  }
  const { kpis, events } = state.radar;
  $('#asof').innerHTML = `${state.radar.asOf ? `snapshot · ${state.radar.asOf.slice(0, 16).replace('T', ' ')} UTC` : `<span class="live">● live</span> scan · ${state.radar.generatedAt?.slice(11, 16)} UTC`}
    <span class="feeds">${Object.entries(state.radar.feeds ?? {}).map(([id, f]) => `<i class="${f.ok ? 'ok' : 'down'}" title="${f.ok ? f.events + ' events' : esc(f.error)}">${id}</i>`).join('')}</span>`;
  $('#kpis').innerHTML = `
    <div class="kpi money wide"><b>${fmtEUR(kpis.pipelineEUR)}</b><span>indicative weighted pipeline · ${fmtEUR(kpis.taskingPipelineEUR)} tasking + ${fmtEUR(kpis.analyticsPipelineEUR)} analytics <a href="#" id="pbInfo" title="how is this computed?">${ICON.info}</a></span></div>
    <div class="kpi red"><b>${kpis.commercialSharePct ?? kpis.unmetSharePct}%</b><span>of demand needs paid imagery · ${kpis.gaps} coverage gaps</span></div>
    <div class="kpi green"><b>${kpis.ready}</b><span>events free Copernicus can see today</span></div>
    <div class="kpi cyan"><b>${fmt(kpis.scenes24h)}<span class="spark"> ${kpis.euScenes24h != null ? '· ' + fmt(kpis.euScenes24h) + ' EU' : ''}</span></b><span>new S2 scenes / 24 h</span></div>
    <div class="kpi"><b>${kpis.eventsAnalysed}<span class="spark"> / ${kpis.eventsInScope}</span></b><span>events analysed${kpis.activations ? ` · <b class="ems">${kpis.activations} CEMS</b>` : ''}</span></div>`;
  $('#pbInfo').addEventListener('click', (ev) => { ev.preventDefault(); showPricebook(); });

  const counts = { all: events.length, gap: 0, partial: 0, ready: 0, cems: 0 };
  for (const e of events) { counts[CLS_KEY[e.cls]]++; if (e.activation) counts.cems++; }
  document.querySelectorAll('#filters button').forEach((b) => {
    b.classList.toggle('on', b.dataset.f === state.filter);
    b.querySelector('em').textContent = counts[b.dataset.f];
  });

  const shown = visible(events);
  $('#list').innerHTML = customRow + (shown.length ? shown.map((e) => rowHtml(e, e.id, events.indexOf(e) + 1)).join('') : '<div class="skeleton">no events match this filter</div>');
  bindRows(events);

  markers.clearLayers();
  selMarker = null;
  for (const e of shown) {
    if (e.lat == null) continue;
    const m = L.circleMarker([e.lat, e.lng], {
      radius: 5 + e.demand / 12, color: COLORS[e.cls], weight: e.activation ? 3 : 1.5,
      fillColor: COLORS[e.cls], fillOpacity: 0.35, dashArray: e.activation ? '2 3' : null,
    });
    m.bindTooltip(`<b>${esc(e.title)}</b><br>${fmtEUR(e.dealEUR)} · ${esc(e.recommendation?.label ?? '')}`, { direction: 'top' });
    m.on('click', () => select(e, false));
    markers.addLayer(m);
  }
}

function bindRows(events) {
  document.querySelectorAll('.row[data-key]').forEach((el) =>
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      if (key === 'custom') { if (state.custom) select(state.custom); }
      else select(events.find((e) => e.id === key));
    }));
}

// --- lead detail ------------------------------------------------------------
function select(e, fly = true) {
  if (!e) return;
  const key = e.custom ? 'custom' : e.id;
  state.selectedId = key;
  writeHash();
  document.querySelectorAll('.row[data-key]').forEach((el) => el.classList.toggle('sel', el.dataset.key === key));
  if (fly && e.lat != null) map.flyTo([e.lat, e.lng], Math.max(map.getZoom(), 7), { duration: 0.8 });

  footprints.clearLayers();
  for (const f of (e.footprints ?? []).filter((f) => f.geom)) {
    L.geoJSON({ type: 'Feature', geometry: f.geom, properties: f }, {
      style: { color: '#56c8ff', weight: 1, fillOpacity: 0.04, dashArray: '3 4' },
      onEachFeature: (feat, layer) => layer.bindTooltip(`${feat.properties.dt?.slice(0, 10) ?? ''} · cloud ${Math.round(feat.properties.cloud ?? 0)}%`),
    }).addTo(footprints);
  }

  const thumb = (e.recentScenes ?? []).find((s) => s.thumb);
  const rows = (e.recentScenes ?? []).slice(0, 4).map((s) =>
    `<tr><td>${s.dt?.slice(0, 10)}</td><td>${esc(s.platform ?? '')}</td><td>${s.cloud != null ? Math.round(s.cloud) + '%' : '—'}</td></tr>`).join('');
  const link = e.sources?.[0] ? `<a href="${esc(e.sources[0])}" target="_blank" rel="noopener">source ↗</a>` : '';
  const popup = `<div class="pop"><h3>${esc(e.title)}</h3>
    <div class="place">${esc(e.alertTitle || e.place)} · ${esc(e.catId)} · opened ${e.openedISO?.slice(0, 10)} ${link}</div>
    ${e.activation ? `<div class="emsline">Copernicus EMS <b>${esc(e.activation)}</b> active — the EU is already buying imagery here</div>` : ''}
    <div class="offer ${e.recommendation?.motion}"><span>recommended</span><b>${esc(e.recommendation?.label)}</b>
      <em>${fmtEUR(e.dealEUR)} <small>indicative · ~${fmt(e.areaKm2)} km²</small></em></div>
    ${thumb ? `<img class="thumb" src="${esc(thumb.thumb)}" alt="latest Sentinel-2 thumbnail">` : '<div class="none">NO FREE OPTICAL IMAGERY: no Sentinel-2 pass in the event window</div>'}
    <table>
      <tr><td>classification</td><td style="color:${COLORS[e.cls]}">${e.cls}${e.gapReason ? ` · ${REASON[e.gapReason]}` : ''}</td></tr>
      <tr><td>coverage gap / VHR gap / free-serviceable</td><td><span style="color:var(--red)">${e.coverageGap ?? '—'}</span> / <span style="color:${RES_COLOR}">${e.resolutionGap ?? '—'}</span> / <span style="color:var(--green)">${e.serviceable}</span></td></tr>
      <tr><td>Sentinel-1 radar (all-weather)</td><td>${e.sarLastAgeDays != null ? `last pass ${e.sarLastAgeDays} d ago` : 'no pass'}</td></tr>
      <tr><td>S2 revisit cadence (observed)</td><td>${e.cadenceDays != null ? e.cadenceDays + ' d' : '—'}</td></tr>
      <tr><td>next Sentinel-2 look</td><td class="nextpass">propagating…</td></tr>
      ${e.magnitudeValue != null ? `<tr><td>magnitude</td><td>${esc(e.magnitudeValue)} ${esc(e.magnitudeUnit ?? '')}</td></tr>` : ''}
      ${rows}</table>
    <div class="actions"><button data-act="brief">${ICON.copy} Copy sales brief</button><button data-act="link">${ICON.link} Copy link</button></div></div>`;

  if (selMarker) { markers.removeLayer(selMarker); selMarker = null; }
  const anchor = e.custom && pinMarker ? pinMarker : (selMarker = L.marker([e.lat, e.lng]).addTo(markers));
  anchor.bindPopup(popup, { maxWidth: 360, autoPan: true });
  anchor.once('popupopen', (ev) => {
    const root = ev.popup.getElement();
    root.querySelector('[data-act="brief"]').addEventListener('click', () => copy(toBrief(e), 'sales brief copied'));
    root.querySelector('[data-act="link"]').addEventListener('click', () => copy(location.href, 'link copied'));
    const el = root.querySelector('.nextpass');
    setTimeout(() => {
      const b = nextS2Pass(e.lat, e.lng);
      el.textContent = b === undefined ? 'orbit data unavailable' : b ? `in ~${(b.t / 3600e3).toFixed(1)} h · ${b.name}` : 'none in 4 d: free eyes cannot see this';
      if (b === null) el.style.color = 'var(--red)';
    }, 30);
  });
  setTimeout(() => anchor.openPopup(), fly ? 900 : 50); // after flyTo settles
}

// --- custom AOI pin ---------------------------------------------------------
function setPinMode(on) {
  state.pinMode = on;
  $('#pinBtn').classList.toggle('on', on);
  map.getContainer().classList.toggle('pin-mode', on);
}

function drawPin() {
  pinLayer.clearLayers();
  if (!state.pin) return;
  aoiCircle = L.circle([state.pin.lat, state.pin.lng], { radius: state.radiusKm * 1000, color: PIN_COLOR, weight: 1.5, fillOpacity: 0.08, dashArray: '5 5' }).addTo(pinLayer);
  pinMarker = L.marker([state.pin.lat, state.pin.lng], { draggable: true }).addTo(pinLayer);
  pinMarker.bindTooltip(`custom AOI · r ${state.radiusKm} km · drag to move`, { direction: 'top' });
  pinMarker.on('dragend', () => {
    const p = pinMarker.getLatLng();
    state.pin = { lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5) };
    aoiCircle.setLatLng(p);
    fetchCustom();
  });
}

let customSeq = 0;
async function fetchCustom() {
  if (!state.pin) return;
  const my = ++customSeq;
  state.customLoading = true;
  state.custom = null;
  writeHash();
  render();
  try {
    const data = await loadAoi({ ...state.pin, radiusKm: state.radiusKm, days: state.days });
    if (my !== customSeq) return; // superseded by a newer radius/drag
    state.custom = data;
    state.customLoading = false;
    render();
    select(data, false);
  } catch (e) {
    if (my !== customSeq) return;
    state.customLoading = false;
    render();
    showErr('custom AOI failed: ' + e.message);
  }
}

function clearPin() {
  state.pin = null;
  state.custom = null;
  if (state.selectedId === 'custom') state.selectedId = null;
  pinLayer.clearLayers();
  pinMarker = aoiCircle = null;
  $('#pinClear').classList.add('hidden');
  setPinMode(false);
  writeHash();
  render();
}

// --- exports + misc ---------------------------------------------------------
function download(name, body, type) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([body], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportAs(kind) {
  if (!state.radar) return;
  const leads = [...(state.custom ? [state.custom] : []), ...visible(state.radar.events)];
  const stem = `terrasignal-${state.region}-${state.days}d`;
  if (kind === 'csv') download(`${stem}.csv`, toCsv(leads), 'text/csv');
  if (kind === 'geojson') download(`${stem}.geojson`, JSON.stringify(toGeoJson(leads, { region: state.radar.region }), null, 1), 'application/geo+json');
  if (kind === 'feed') window.open(feedUrl(state.region), '_blank');
  toast(kind === 'feed' ? 'Atom feed opened: subscribe in Slack, Teams or any reader' : `exported ${leads.length} leads`);
}

async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); } catch { /* insecure context */ }
  toast(msg);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
const showErr = (m) => { $('#err').textContent = m; $('#err').classList.remove('hidden'); };
const hideErr = () => $('#err').classList.add('hidden');

function showPricebook() {
  const pb = Object.entries(PRICEBOOK).filter(([k]) => k !== 'currency')
    .map(([, p]) => `<tr><td>${esc(p.label)}</td><td>${p.perKm2 ? `€${p.perKm2}/km²` : `€${fmt(p.perScene)}/scene`}${p.minKm2 ? ` · min ${p.minKm2} km²` : ''}${p.minEur ? ` · min €${fmt(p.minEur)}` : ''}</td></tr>`).join('');
  $('#modalBody').innerHTML = `<h2>How the pipeline is computed</h2>
    <p>Each event's demand is split three ways: <b style="color:var(--red)">coverage gap</b> (free Sentinels have not seen it well),
    <b style="color:${RES_COLOR}">VHR gap</b> (seen, but the buyer needs sub-metre detail) and <b style="color:var(--green)">free-serviceable</b>.
    The recommended product's list value for the hazard's typical AOI is weighted by the matching share.</p>
    <table class="pb">${pb}</table>
    <p class="dim">Prices are <b>illustrative placeholders</b>. Load your own price book (<code>src/core/value.mjs</code>) to turn this into your real pipeline.</p>`;
  $('#modal').classList.remove('hidden');
}

// --- wiring -----------------------------------------------------------------
$('#region').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  state.region = b.dataset.v;
  state.selectedId = null;
  syncControls();
  writeHash();
  map.flyTo(VIEWS[state.region].center, VIEWS[state.region].zoom, { duration: 1 });
  fetchRadar();
});
$('#days').addEventListener('change', (e) => { state.days = Number(e.target.value); writeHash(); fetchRadar(); if (state.pin) fetchCustom(); });
$('#refresh').addEventListener('click', fetchRadar);
$('#filters').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  state.filter = b.dataset.f;
  writeHash();
  render();
});
$('#pinBtn').addEventListener('click', () => setPinMode(!state.pinMode));
$('#pinClear').addEventListener('click', clearPin);
map.on('click', (ev) => {
  if (!state.pinMode) return;
  state.pin = { lat: +ev.latlng.lat.toFixed(5), lng: +ev.latlng.lng.toFixed(5) };
  setPinMode(false);
  drawPin();
  $('#pinClear').classList.remove('hidden');
  fetchCustom();
});
let radiusTimer;
$('#radius').addEventListener('input', (e) => {
  state.radiusKm = Number(e.target.value);
  $('#radiusVal').textContent = `${state.radiusKm} km`;
  aoiCircle?.setRadius(state.radiusKm * 1000);
  clearTimeout(radiusTimer);
  if (state.pin) radiusTimer = setTimeout(fetchCustom, 450);
});
$('#exportBtn').addEventListener('click', (ev) => { ev.stopPropagation(); $('#exportMenu').classList.toggle('hidden'); });
$('#exportMenu').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (b) exportAs(b.dataset.x);
  $('#exportMenu').classList.add('hidden');
});
document.addEventListener('click', () => $('#exportMenu').classList.add('hidden'));
$('#shareBtn').addEventListener('click', () => copy(location.href, 'link to this view copied'));
$('#modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal' || ev.target.closest('.close')) $('#modal').classList.add('hidden'); });

function syncControls() {
  document.querySelectorAll('#region button').forEach((x) => x.classList.toggle('on', x.dataset.v === state.region));
  $('#days').value = String(state.days);
  $('#radius').value = String(state.radiusKm);
  $('#radiusVal').textContent = `${state.radiusKm} km`;
}

readHash();
syncControls();
map.setView(VIEWS[state.region].center, VIEWS[state.region].zoom);
fetchRadar();
startConstellation(map);
if (state.pin) {
  drawPin();
  $('#pinClear').classList.remove('hidden');
  fetchCustom();
}
window.terrasignal = { state, map, mode, select: (id) => select(state.radar?.events.find((e) => e.id === id)) }; // demo/debug hook
