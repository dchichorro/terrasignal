import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, toGeoJson, toAtom, toBrief } from '../src/core/export.mjs';

const lead = {
  id: 'X_1', title: 'Flood, "Portugal", north', place: 'Portugal', catId: 'floods', src: 'GDACS', mergedFrom: ['GDACS', 'EONET'],
  lat: 41.1, lng: -8.6, openedISO: '2026-10-01T00:00:00Z', cls: 'TASKING GAP', gapReason: 'cloud', demand: 80, opportunity: 60,
  serviceable: 20, areaKm2: 1963, dealEUR: 60000, weightedEUR: 36000, recommendation: { label: 'Commercial SAR tasking', motion: 'tasking' }, sources: ['https://gdacs.org/x'],
};

test('CSV quotes cells and has one row per lead', () => {
  const csv = toCsv([lead]);
  const [head, row] = csv.trim().split('\n');
  assert.ok(head.startsWith('id,title,'));
  assert.ok(row.includes('"Flood, ""Portugal"", north"'));
  assert.ok(row.includes('GDACS+EONET'));
});

test('GeoJSON is a FeatureCollection of points', () => {
  const g = toGeoJson([lead], { region: 'Europe' });
  assert.equal(g.type, 'FeatureCollection');
  assert.deepEqual(g.features[0].geometry.coordinates, [-8.6, 41.1]);
  assert.equal(g.features[0].properties.indicative_deal_eur, 60000);
});

test('Atom feed lists tasking leads (incl. VHR upsell on covered events) and escapes XML', () => {
  const ready = { ...lead, id: 'R', cls: 'COPERNICUS-READY', recommendation: { motion: 'analytics' } };
  const upsell = { ...ready, id: 'U', recommendation: { motion: 'tasking' } };
  const atom = toAtom({ region: 'Europe', generatedAt: '2026-10-07T00:00:00Z', events: [lead, ready, upsell] });
  assert.equal((atom.match(/<entry>/g) ?? []).length, 2);
  assert.ok(atom.includes('&quot;Portugal&quot;'));
});

test('brief explains the shortfall and the offer', () => {
  const b = toBrief(lead);
  assert.ok(b.includes('cloud-covered'));
  assert.ok(b.includes('€60k'));
});
