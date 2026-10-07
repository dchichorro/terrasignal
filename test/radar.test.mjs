import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRadar, buildAoi } from '../src/radar.mjs';

const NOW = Date.parse('2026-10-07T00:00:00Z');
const iso = (d) => new Date(NOW - d * 86_400_000).toISOString();
const passthrough = (_key, _ttl, loader) => Promise.resolve().then(loader);

const src = (id, events) => ({ id, label: id, fetchEvents: async () => events });
const supply = {
  optical: async ({ lat }) => (lat > 0 ? [{ dt: iso(1), cloud: 5, thumb: 't' }, { dt: iso(4), cloud: 10 }] : []),
  sar: async () => [],
  pulse: async () => ({ global24h: 12000, eu24h: 1500 }),
};

test('buildRadar scores, ranks by opportunity, and survives a dead feed', async () => {
  const sources = [
    src('GDACS', [{ id: 'covered', src: 'GDACS', catId: 'wildfires', lat: 40, lng: 10, openedISO: iso(2) }]),
    src('EONET', [{ id: 'blind', src: 'EONET', catId: 'wildfires', lat: -20, lng: 30, openedISO: iso(2) }]),
    { id: 'BROKEN', label: 'x', fetchEvents: async () => { throw new Error('boom'); } },
  ];
  const r = await buildRadar({ region: 'global', days: 30, sources, supply, cached: passthrough, nowMs: NOW });
  assert.deepEqual(r.events.map((e) => e.id), ['blind', 'covered']);
  assert.equal(r.events[0].cls, 'TASKING GAP');
  assert.equal(r.events[1].cls, 'COPERNICUS-READY');
  assert.equal(r.feeds.BROKEN.ok, false);
  assert.equal(r.feeds.GDACS.events, 1);
  assert.equal(r.kpis.scenes24h, 12000);
  assert.ok(r.kpis.pipelineEUR > 0);
  assert.ok(r.events.every((e) => e.recommendation && e.dealEUR > 0));
});

test('buildAoi validates input', async () => {
  await assert.rejects(buildAoi({ lat: 'x', lng: 1 }, { cached: passthrough, supply }), /lat\/lng required/);
  await assert.rejects(buildAoi({ lat: 95, lng: 1 }, { cached: passthrough, supply }), /out of range/);
});

test('buildAoi scores a pin with footprints and a lead', async () => {
  const a = await buildAoi({ lat: 40, lng: 10, radiusKm: 5 }, { cached: passthrough, supply });
  assert.equal(a.custom, true);
  assert.equal(a.radiusKm, 5);
  assert.equal(a.count, 2);
  assert.ok(a.recommendation.label);
});
