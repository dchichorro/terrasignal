const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const VIEWS = { eu: { center: [48, 12], zoom: 4 }, global: { center: [22, 5], zoom: 2 } };
const COLORS = { 'TASKING GAP': '#ff5d6c', PARTIAL: '#ffb454', 'COPERNICUS-READY': '#3ddc97' };

const map = L.map('map', { zoomControl: false, worldCopyJump: true }).setView(VIEWS.eu.center, VIEWS.eu.zoom);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri — Earth, GEBCO, NOAA · data: NASA EONET, GDACS (EC JRC/UN), ESA Copernicus Sentinel-2 via Element 84',
  maxZoom: 17,
}).addTo(map);
let markers = L.layerGroup().addTo(map);
let footprints = L.layerGroup().addTo(map);
let selPin = null;
const state = { region: 'eu', days: 45, radar: null, selected: null };

async function fetchRadar() {
  $('#list').innerHTML = '<div class="skeleton">scanning Copernicus catalogue…</div>';
  try {
    let data = null;
    try {
      const live = await fetch(`api/radar?region=${state.region}&days=${state.days}`);
      if (live.ok) data = await live.json();
    } catch { /* static hosting: no live API */ }
    if (!data) {
      const snap = await fetch(`data/radar-${state.region}-${state.days}.json`);
      if (!snap.ok) throw new Error('no live API and no static snapshot');
      data = await snap.json();
    }
    state.radar = data;
    $('#err').classList.add('hidden');
    render();
  } catch (e) {
    $('#err').textContent = 'radar scan failed: ' + e.message;
    $('#err').classList.remove('hidden');
  }
}

function render() {
  const { kpis, events } = state.radar;
  const asof = $('#asof');
  if (asof) {
    asof.textContent = state.radar.asOf
      ? `static snapshot · ${state.radar.asOf.slice(0, 16).replace('T', ' ')} UTC`
      : 'live scan';
  }
  const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'));
  $('#kpis').innerHTML = `
    <div class="kpi red"><b>${kpis.unmetSharePct}%</b><span>demand not met by free imagery → ${kpis.gaps} tasking gaps</span></div>
    <div class="kpi green"><b>${kpis.ready}</b><span>events serviceable today from Copernicus</span></div>
    <div class="kpi cyan"><b>${fmt(kpis.scenes24h)}<span class="spark"> ${kpis.euScenes24h != null ? '· ' + fmt(kpis.euScenes24h) + ' EU' : ''}</span></b><span>new S2 scenes ingested / 24 h</span></div>
    <div class="kpi"><b>${kpis.eventsAnalysed}<span class="spark"> / ${kpis.eventsInScope}</span></b><span>open EO-relevant events analysed</span></div>`;

  $('#list').innerHTML = events.map((e, i) => {
    const cls = e.cls === 'TASKING GAP' ? 'gap' : e.cls === 'COPERNICUS-READY' ? 'ready' : 'partial';
    const supplyPct = Math.round(e.supply * 100);
    const gapW = (e.demand / 100) * (100 - supplyPct);
    const nowW = e.demand - gapW;
    return `<div class="row" data-i="${i}">
      <div class="top"><span class="rank">${i + 1}</span><span class="title">${esc(e.title)}</span>
        <span class="badge ${cls}">${e.cls}</span></div>
      <div class="metrics"><span>gap <b style="color:${COLORS[e.cls]}">${e.opportunity}</b></span>
        <span>last pass <b>${e.lastAgeDays != null ? e.lastAgeDays + 'd' : 'none'}</b></span>
        <span>cloud <b>${e.medianCloud != null ? e.medianCloud + '%' : '—'}</b></span>
        <span>passes <b>${e.count}</b></span><span>demand <b>${e.demand}</b></span><span style="color:#56c8ff">${e.src}</span></div>
      <div class="meter"><i style="width:${gapW}%;background:var(--red)"></i><i style="left:${gapW}%;width:${nowW}%;background:var(--green)"></i></div>
    </div>`;
  }).join('');
  document.querySelectorAll('.row').forEach((el) =>
    el.addEventListener('click', () => select(events[el.dataset.i], Number(el.dataset.i))));

  markers.clearLayers();
  for (const [i, e] of events.entries()) {
    if (e.lat == null) continue;
    const m = L.circleMarker([e.lat, e.lng], {
      radius: 5 + e.demand / 12, color: COLORS[e.cls], weight: 1.5,
      fillColor: COLORS[e.cls], fillOpacity: 0.35,
    });
    m.bindTooltip(`<b>${esc(e.title)}</b><br>gap ${e.opportunity} · demand ${e.demand}`, { direction: 'top' });
    m.on('click', () => select(e, i, false));
    markers.addLayer(m);
  }
}

function select(e, i, fromList = true) {
  state.selected = i;
  document.querySelectorAll('.row').forEach((el) => el.classList.toggle('sel', Number(el.dataset.i) === i));
  if (fromList && e.lat != null) map.flyTo([e.lat, e.lng], Math.max(map.getZoom(), 6), { duration: 0.8 });
  footprints.clearLayers();
  const fps = (e.footprints ?? []).filter((f) => f.geom);
  for (const f of fps) {
    L.geoJSON({ type: 'Feature', geometry: f.geom, properties: { dt: f.dt, cloud: f.cloud } }, {
      style: { color: '#56c8ff', weight: 1, fillOpacity: 0.04, dashArray: '3 4' },
      onEachFeature: (feat, layer) => layer.bindTooltip(`${feat.properties.dt?.slice(0, 10) ?? ''} · cloud ${Math.round(feat.properties.cloud ?? 0)}%`),
    }).addTo(footprints);
  }
  const thumb = (e.recentScenes ?? []).find((s) => s.thumb);
  const rows = (e.recentScenes ?? []).slice(0, 5).map((s) =>
    `<tr><td>${s.dt?.slice(0, 10)}</td><td>${esc(s.platform ?? '')}</td><td>${s.cloud != null ? Math.round(s.cloud) + '%' : '—'}</td></tr>`).join('');
    const popup = `<div class="pop"><h3>${esc(e.title)}</h3><div class="place">${esc(e.alertTitle || e.place)} · ${esc(e.catId)} · opened ${e.openedISO?.slice(0, 10)}</div>
    ${thumb ? `<img class="thumb" src="${thumb.thumb}" alt="latest Sentinel-2 thumbnail">` : '<div class="none">NO FREE IMAGERY — no Sentinel-2 overpass in event window, free data cannot serve this demand</div>'}
    <table>
      <tr><td>classification</td><td style="color:${COLORS[e.cls]}">${e.cls}</td></tr>
      <tr><td>tasking gap / serviceable now</td><td>${e.opportunity} / ${e.serviceable}</td></tr>
      <tr><td>revisit cadence (observed)</td><td>${e.cadenceDays != null ? e.cadenceDays + ' d' : '—'}</td></tr>
      <tr><td>next Sentinel-2 look</td><td id="nextpass">propagating…</td></tr>
      <tr><td>magnitude</td><td>${e.magnitudeValue != null ? e.magnitudeValue + ' ' + esc(e.magnitudeUnit ?? '') : '—'}</td></tr>
      ${rows}</table></div>`;
  if (selPin) markers.removeLayer(selPin);
  selPin = L.marker([e.lat, e.lng]).addTo(markers);
  selPin.bindPopup(popup, { maxWidth: 340, autoPan: true });
  setTimeout(() => { selPin.openPopup(); fillNextPass(e); }, 900); // after flyTo settles and popup DOM exists
}

// --- live Copernicus constellation: TLEs propagated in-browser (satellite.js) ---
const SAT_COLORS = [['SENTINEL-1', '#56c8ff'], ['SENTINEL-2', '#3ddc97'], ['SENTINEL-3', '#7aa2ff'], ['SENTINEL-5', '#c58aff'], ['SENTINEL-6', '#ffb454']];
const satColor = (n) => (SAT_COLORS.find(([p]) => n.startsWith(p)) ?? [, '#8b96ad'])[1];
let satrecs = [];
const satMarkers = L.layerGroup().addTo(map);

function parseTleText(txt) {
  const L = txt.split('\n').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i + 2 < L.length; i += 3) {
    if (L[i].startsWith('SENTINEL') && /^1 /.test(L[i + 1]) && /^2 /.test(L[i + 2])) out.push({ name: L[i], l1: L[i + 1], l2: L[i + 2] });
  }
  return out;
}

async function loadSats() {
  if (typeof satellite === 'undefined') return;
  let tles = null;
  try { const r = await fetch('data/tle.json'); if (r.ok) tles = await r.json(); } catch { /* no bundle */ }
  if (!tles?.length) {
    try { tles = parseTleText(await (await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle')).text()); } catch { return; }
  }
  satrecs = tles.map((t) => ({ name: t.name, rec: satellite.twoline2satrec(t.l1, t.l2) })).filter((s) => s.rec);
  tickSats();
  setInterval(tickSats, 15000);
}

function satPos(rec, date) {
  const pv = satellite.propagate(rec, date);
  if (!pv.position || !Number.isFinite(pv.position.x)) return null;
  const geo = satellite.eciToGeodetic(pv.position, satellite.gstime(date));
  return { lat: (geo.latitude * 180) / Math.PI, lng: (geo.longitude * 180) / Math.PI, alt: geo.height, vel: Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z) };
}

function tickSats() {
  satMarkers.clearLayers();
  const now = new Date();
  for (const s of satrecs) {
    const p = satPos(s.rec, now);
    if (!p || !Number.isFinite(p.lat)) continue;
    satMarkers.addLayer(L.circleMarker([p.lat, p.lng], { radius: 3.5, color: satColor(s.name), weight: 1.5, fillOpacity: 0.9 })
      .bindTooltip(`${s.name} · ${Math.round(p.alt)} km · ${p.vel.toFixed(1)} km/s`, { direction: 'top' }));
  }
}

const havKm = (la1, lo1, la2, lo2) => {
  const R = 6371, dLa = ((la2 - la1) * Math.PI) / 180, dLo = ((lo2 - lo1) * Math.PI) / 180;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// next time a Sentinel-2 ground track passes within half-swath (~150 km) of a point
function nextS2Pass(lat, lng) {
  const STEP = 45e3, HORIZON = 4 * 86400e3, t0 = Date.now();
  let best = null;
  for (const s of satrecs.filter((x) => x.name.startsWith('SENTINEL-2'))) {
    for (let t = STEP; t < HORIZON; t += STEP) {
      const p = satPos(s.rec, new Date(t0 + t));
      if (p && havKm(lat, lng, p.lat, p.lng) < 150) { if (!best || t < best.t) best = { t, name: s.name }; break; }
    }
  }
  return best;
}

function fillNextPass(e) {
  const el = document.getElementById('nextpass');
  if (!el) return;
  setTimeout(() => {
    if (!satrecs.length) { el.textContent = 'orbit data unavailable'; return; }
    const b = nextS2Pass(e.lat, e.lng);
    el.textContent = b ? `in ~${(b.t / 3600e3).toFixed(1)} h · ${b.name}` : 'none in 4 d — free eyes cannot see this';
    el.style.color = b ? '' : 'var(--red)';
  }, 30);
}

$('#region').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  document.querySelectorAll('#region button').forEach((x) => x.classList.toggle('on', x === b));
  state.region = b.dataset.v;
  map.flyTo(VIEWS[state.region].center, VIEWS[state.region].zoom, { duration: 1 });
  fetchRadar();
});
$('#days').addEventListener('change', (e) => { state.days = Number(e.target.value); fetchRadar(); });
$('#refresh').addEventListener('click', fetchRadar);

fetchRadar();
loadSats();
