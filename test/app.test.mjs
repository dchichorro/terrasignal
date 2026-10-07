import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHandler } from '../src/app.mjs';
import { ValidationError } from '../src/core/aoi.mjs';

const lead = { id: 'L1', title: 'Flood', catId: 'floods', lat: 1, lng: 2, cls: 'TASKING GAP', demand: 50, opportunity: 40, serviceable: 10,
  areaKm2: 100, dealEUR: 1000, weightedEUR: 400, recommendation: { label: 'SAR', motion: 'tasking' }, openedISO: '2026-10-01T00:00:00Z' };
let server, base;

before(async () => {
  const handler = createHandler({
    regions: { eu: {}, global: {} },
    buildRadar: async (p) => ({ region: p.region, days: p.days, generatedAt: '2026-10-07T00:00:00Z', kpis: {}, events: [lead] }),
    buildAoi: async ({ lat }) => { if (lat == null) throw new ValidationError('lat/lng required'); return { ok: 1 }; },
  });
  server = createServer(handler).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const get = (p) => fetch(base + p);

test('radar JSON and validation errors', async () => {
  assert.equal((await (await get('/api/radar?region=global&days=30')).json()).region, 'global');
  assert.equal((await get('/api/radar?region=mars')).status, 400);
  assert.equal((await get('/api/radar?days=900')).status, 400);
  assert.equal((await get('/api/aoi')).status, 400);
  assert.equal((await get('/api/nope')).status, 404);
});

test('exports: CSV download, GeoJSON, Atom', async () => {
  const csv = await get('/api/leads.csv');
  assert.match(csv.headers.get('content-disposition'), /attachment/);
  assert.match(await csv.text(), /^id,title/);
  assert.equal((await (await get('/api/leads.geojson')).json()).features.length, 1);
  assert.match(await (await get('/feed.xml')).text(), /<feed xmlns/);
});

test('static hosting serves pages and core modules, refuses traversal', async () => {
  assert.equal((await get('/')).status, 200);
  const core = await get('/core/score.mjs');
  assert.equal(core.status, 200);
  assert.equal(core.headers.get('content-type'), 'text/javascript');
  assert.equal((await get('/%2e%2e/package.json')).status, 404);
  assert.equal((await get('/core/%2e%2e/app.mjs')).status, 404);
  assert.equal((await get('/api/health')).status, 200);
  assert.equal((await get('/api/openapi.json')).status, 200);
});
