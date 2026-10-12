// HTTP handler factory: routing, validation, exports and static hosting.
// `createHandler(deps)` is pure wiring — tests inject fake radar/aoi builders.
import { readFile } from 'node:fs/promises';
import { extname, normalize } from 'node:path';
import { ValidationError } from './core/aoi.mjs';
import { toCsv, toGeoJson, toAtom } from './core/export.mjs';
import { OPENAPI } from './openapi.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.xml': 'application/atom+xml',
  '.geojson': 'application/geo+json',
  '.csv': 'text/csv; charset=utf-8',
};
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
};

function radarParams(sp, regions) {
  const region = sp.get('region') ?? 'eu';
  if (!regions[region]) throw new ValidationError(`region must be one of ${Object.keys(regions).join(', ')}`);
  const days = Number(sp.get('days') ?? 45);
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new ValidationError('days must be an integer 1–90');
  const focus = Number(sp.get('focus') ?? 30);
  if (!Number.isInteger(focus) || focus < 1 || focus > 60) throw new ValidationError('focus must be an integer 1–60');
  return { region, days, focus };
}

export function createHandler({ buildRadar, buildAoi, regions, publicDir = `${ROOT}public/`, coreDir = `${ROOT}src/core/` }) {
  const startedAt = Date.now();
  const radarFor = (url) => buildRadar(radarParams(url.searchParams, regions));
  const site = (req) => `http://${req.headers.host}/`;

  const routes = {
    '/api/health': async () => ({ json: { ok: true, uptimeS: Math.round((Date.now() - startedAt) / 1000) } }),
    '/api/openapi.json': async () => ({ json: OPENAPI }),
    '/api/radar': async (url) => ({ json: await radarFor(url) }),
    '/api/aoi': async (url) => {
      const sp = url.searchParams;
      return {
        json: await buildAoi({
          lat: sp.get('lat'),
          lng: sp.get('lng'),
          radiusKm: sp.get('radiusKm') ?? sp.get('radius') ?? 10,
          days: sp.get('days') ?? 45,
        }),
      };
    },
    '/api/leads.csv': async (url) => ({ type: MIME['.csv'], body: toCsv((await radarFor(url)).events), download: 'terrasignal-leads.csv' }),
    '/api/leads.geojson': async (url) => {
      const r = await radarFor(url);
      return { type: MIME['.geojson'], body: JSON.stringify(toGeoJson(r.events, { generatedAt: r.generatedAt, region: r.region })) };
    },
    '/feed.xml': async (url, req) => ({
      type: MIME['.xml'],
      body: toAtom(await radarFor(url), { selfUrl: site(req) + 'feed.xml' + url.search, siteUrl: site(req) }),
    }),
  };

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });
      const route = routes[url.pathname];
      if (route) {
        const out = await route(url, req);
        if (out.json !== undefined) return send(res, 200, out.json);
        const headers = { 'content-type': out.type, 'cache-control': 'no-store', ...SECURITY_HEADERS };
        if (out.download) headers['content-disposition'] = `attachment; filename="${out.download}"`;
        res.writeHead(200, headers);
        return res.end(out.body);
      }
      if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'unknown endpoint' });
      // isomorphic core modules are served to the browser from src/core
      if (url.pathname.startsWith('/core/')) return serveFile(res, coreDir, url.pathname.slice('/core/'.length));
      return serveFile(res, publicDir, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    } catch (err) {
      if (err instanceof ValidationError) return send(res, 400, { error: err.message });
      console.error(`${req.method} ${req.url}:`, err);
      return send(res, 502, { error: 'upstream data unavailable', detail: String(err?.message ?? err) });
    }
  };
}

async function serveFile(res, dir, rel) {
  let path;
  try {
    path = normalize(decodeURIComponent(rel));
  } catch {
    return notFound(res);
  }
  if (path.startsWith('..') || path.startsWith('/')) return notFound(res);
  try {
    const body = await readFile(dir + path);
    res.writeHead(200, {
      'content-type': MIME[extname(path)] ?? 'application/octet-stream',
      'cache-control': path.startsWith('data/') ? 'no-cache' : 'public, max-age=300',
      ...SECURITY_HEADERS,
    });
    res.end(body);
  } catch {
    notFound(res);
  }
}

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain', ...SECURITY_HEADERS }).end('not found');
}

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...SECURITY_HEADERS });
  res.end(JSON.stringify(data));
}
