// Score a user-placed area of interest against live Copernicus supply.
// Isomorphic: the Node server wraps it with a disk cache; the static site runs
// it in the browser straight against the CORS-open STAC.
import { scenesAroundPoint, sarScenesAroundPoint } from './stac.mjs';
import { scoreEvent } from './score.mjs';
import { toLead } from './value.mjs';

export class ValidationError extends Error {}

export function parseAoi({ lat, lng, radiusKm = 10, days = 45 } = {}) {
  lat = Number(lat);
  lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new ValidationError('lat/lng required');
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new ValidationError('lat/lng out of range');
  return {
    lat,
    lng,
    radiusKm: Math.min(100, Math.max(1, Number(radiusKm) || 10)),
    days: Math.min(90, Math.max(7, Number(days) || 45)),
  };
}

export const sliceScenes = (scenes) => ({
  footprints: scenes.slice(0, 12).map((s) => ({ dt: s.dt, cloud: s.cloud, platform: s.platform, geom: s.geom })),
  recentScenes: scenes.slice(0, 6).map(({ id, dt, cloud, platform, thumb }) => ({ id, dt, cloud, platform, thumb })),
});

/**
 * @param fetchers optional { optical, sar } overrides (caching, tests); each
 *   takes { lng, lat, sinceISO, marginDeg } and resolves to scenes.
 */
export async function scoreAoi(input, { fetchers = {}, nowMs = Date.now() } = {}) {
  const { lat, lng, radiusKm, days } = parseAoi(input);
  const sinceISO = new Date(nowMs - days * 86_400_000).toISOString();
  const q = { lng, lat, sinceISO, marginDeg: radiusKm / 111.32 }; // km → deg lat; stac widens lng by cos(lat)
  const optical = fetchers.optical ?? scenesAroundPoint;
  const sar = fetchers.sar ?? sarScenesAroundPoint;
  const [scenes, sarScenes] = await Promise.all([
    optical(q).catch(() => []),
    sar(q).catch(() => null), // null = SAR unknown → optical-only score
  ]);
  const evt = {
    id: `custom:${lat.toFixed(4)},${lng.toFixed(4)}:r${radiusKm}`,
    title: `Custom AOI ${lat.toFixed(3)}, ${lng.toFixed(3)} · r ${radiusKm} km`,
    place: 'user-placed pin',
    catId: 'manual-events',
    openedISO: new Date(nowMs).toISOString(),
    lat,
    lng,
    radiusKm,
    custom: true,
    src: 'CUSTOM',
  };
  return toLead({ ...scoreEvent(evt, scenes, nowMs, { sarScenes: sarScenes ?? undefined }), ...sliceScenes(scenes) });
}
