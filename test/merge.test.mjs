import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDemand, isSameEvent } from '../src/core/merge.mjs';

const NOW = Date.parse('2026-09-19T00:00:00Z');
const ev = (o) => ({ catId: 'floods', lat: 40, lng: 10, openedISO: new Date(NOW - 2 * 86_400_000).toISOString(), ...o });

test('same hazard nearby is one event; distant is two', () => {
  assert.ok(isSameEvent(ev({}), ev({ lat: 40.5 })));
  assert.ok(!isSameEvent(ev({}), ev({ lat: 45 })));
  assert.ok(isSameEvent(ev({ catId: 'manual-events' }), ev({ lat: 40.1 }))); // cross-taxonomy, on top of each other
});

test('CEMS wins over GDACS, inherits earlier onset and magnitude', () => {
  const gdacs = ev({ id: 'G', src: 'GDACS', magnitudeValue: 3, openedISO: new Date(NOW - 5 * 86_400_000).toISOString(), sources: ['g'] });
  const cems = ev({ id: 'C', src: 'CEMS', activation: 'EMSR9', sources: ['c'] });
  const [m, ...rest] = mergeDemand([[gdacs], [cems]], NOW, 30);
  assert.equal(rest.length, 0);
  assert.equal(m.id, 'C');
  assert.equal(m.magnitudeValue, 3);
  assert.equal(m.openedISO, gdacs.openedISO);
  assert.deepEqual(m.mergedFrom, ['CEMS', 'GDACS']);
  assert.deepEqual(m.sources, ['c', 'g']);
});

test('drops events outside the window and without coordinates', () => {
  const old = ev({ id: 'old', openedISO: new Date(NOW - 60 * 86_400_000).toISOString() });
  const noLoc = ev({ id: 'x', lat: null });
  assert.equal(mergeDemand([[old, noLoc]], NOW, 30).length, 0);
});
