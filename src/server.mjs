#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize } from 'node:path';
import { buildRadar, REGIONS } from './radar.mjs';
import { cached } from './cache.mjs';
import { fetchJson } from './http.mjs';

const PORT = Number(process.env.PORT ?? 4660);
const PUBLIC = new URL('../public/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/radar') {
      const region = REGIONS[url.searchParams.get('region')] ? url.searchParams.get('region') : 'eu';
      const days = Number(url.searchParams.get('days') ?? 45);
      const focus = Number(url.searchParams.get('focus') ?? 30);
      const data = await buildRadar({ region, days, focus });
      return json(res, data);
    }
    if (url.pathname === '/api/pulse') {
      const data = await cached('iss-pulse', 5_000, () =>
        fetchJson('https://api.wheretheiss.at/v1/satellites/25544').catch(() => null),
      );
      return json(res, { iss: data, ts: Date.now() });
    }
    return await serveStatic(res, url.pathname);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(err?.message ?? err) }));
  }
});

async function serveStatic(res, pathname) {
  const rel = normalize(pathname === '/' ? 'index.html' : pathname.slice(1));
  if (rel.startsWith('..')) return notFound(res);
  try {
    const body = await readFile(PUBLIC + rel);
    res.writeHead(200, { 'content-type': MIME[extname(rel)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    notFound(res);
  }
}

function notFound(res) {
  res.writeHead(404).end('not found');
}
function json(res, data) {
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

server.listen(PORT, async () => {
  console.log(`TerraSignal radar on http://localhost:${PORT}`);
  for (const region of ['global', 'eu']) {
    try {
      await buildRadar({ region, days: 45, focus: 30 });
      console.log(`cache warm: ${region}`);
    } catch {
      /* next request will retry live */
    }
  }
});
