// Live Copernicus constellation: TLEs propagated in-browser (satellite.js global).
const SAT_COLORS = [['SENTINEL-1', '#56c8ff'], ['SENTINEL-2', '#3ddc97'], ['SENTINEL-3', '#7aa2ff'], ['SENTINEL-5', '#c58aff'], ['SENTINEL-6', '#ffb454']];
const satColor = (n) => (SAT_COLORS.find(([p]) => n.startsWith(p)) ?? [, '#8b96ad'])[1];
let satrecs = [];

function parseTleText(txt) {
  const lines = txt.split('\n').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    if (lines[i].startsWith('SENTINEL') && /^1 /.test(lines[i + 1]) && /^2 /.test(lines[i + 2])) out.push({ name: lines[i], l1: lines[i + 1], l2: lines[i + 2] });
  }
  return out;
}

export async function startConstellation(map) {
  if (typeof satellite === 'undefined') return;
  const layer = L.layerGroup().addTo(map);
  let tles = null;
  try {
    const r = await fetch('data/tle.json');
    if (r.ok) tles = await r.json();
  } catch { /* no bundle */ }
  if (!tles?.length) {
    try {
      tles = parseTleText(await (await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle')).text());
    } catch {
      return;
    }
  }
  satrecs = tles.map((t) => ({ name: t.name, rec: satellite.twoline2satrec(t.l1, t.l2) })).filter((s) => s.rec);
  const tick = () => {
    layer.clearLayers();
    const now = new Date();
    for (const s of satrecs) {
      const p = satPos(s.rec, now);
      if (!p || !Number.isFinite(p.lat)) continue;
      layer.addLayer(L.circleMarker([p.lat, p.lng], { radius: 3.5, color: satColor(s.name), weight: 1.5, fillOpacity: 0.9 })
        .bindTooltip(`${s.name} · ${Math.round(p.alt)} km · ${p.vel.toFixed(1)} km/s`, { direction: 'top' }));
    }
  };
  tick();
  setInterval(tick, 15000);
}

function satPos(rec, date) {
  const pv = satellite.propagate(rec, date);
  if (!pv.position || !Number.isFinite(pv.position.x)) return null;
  const geo = satellite.eciToGeodetic(pv.position, satellite.gstime(date));
  return { lat: (geo.latitude * 180) / Math.PI, lng: (geo.longitude * 180) / Math.PI, alt: geo.height, vel: Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z) };
}

const havKm = (la1, lo1, la2, lo2) => {
  const R = 6371, dLa = ((la2 - la1) * Math.PI) / 180, dLo = ((lo2 - lo1) * Math.PI) / 180;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/** Next time a Sentinel-2 ground track passes within half-swath (~150 km) of a point. */
export function nextS2Pass(lat, lng) {
  if (!satrecs.length) return undefined;
  const STEP = 45e3, HORIZON = 4 * 86400e3, t0 = Date.now();
  let best = null;
  for (const s of satrecs.filter((x) => x.name.startsWith('SENTINEL-2'))) {
    for (let t = STEP; t < HORIZON; t += STEP) {
      const p = satPos(s.rec, new Date(t0 + t));
      if (p && havKm(lat, lng, p.lat, p.lng) < 150) {
        if (!best || t < best.t) best = { t, name: s.name };
        break;
      }
    }
  }
  return best;
}
