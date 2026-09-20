import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demandScore, supplyStats, scoreEvent, classify } from '../src/score.mjs';

const NOW = Date.parse('2026-09-19T00:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86_400_000).toISOString();
const scene = (d, cloud) => ({ dt: daysAgo(d), cloud });

test('demand decays with event age', () => {
  const base = { catId: 'wildfires', openedISO: daysAgo(2) };
  const fresh = demandScore(base, NOW);
  const old = demandScore({ ...base, openedISO: daysAgo(40) }, NOW);
  assert.ok(fresh > old && fresh <= 1 && old > 0);
});

test('magnitude boosts demand, capped', () => {
  const plain = demandScore({ catId: 'wildfires', openedISO: daysAgo(3) }, NOW);
  const big = demandScore({ catId: 'wildfires', openedISO: daysAgo(3), magnitudeValue: 90000 }, NOW);
  assert.ok(big > plain);
  assert.ok(big <= 1);
});

test('no scenes means zero supply', () => {
  const s = supplyStats([], NOW);
  assert.equal(s.supply, 0);
  assert.equal(s.count, 0);
});

test('fresh clear scenes give high supply; stale cloudy give low', () => {
  const good = supplyStats([scene(0.5, 4), scene(5, 6)], NOW).supply;
  const bad = supplyStats([scene(20, 95), scene(25, 97)], NOW).supply;
  assert.ok(good > 0.75, `good=${good}`);
  assert.ok(bad < 0.2, `bad=${bad}`);
});

test('cadence is the median gap between acquisitions', () => {
  const s = supplyStats([scene(1, 10), scene(6, 10), scene(11, 10), scene(16, 10)], NOW);
  assert.equal(s.cadenceDays, 5);
});

test('classify thresholds', () => {
  assert.equal(classify(0.1), 'TASKING GAP');
  assert.equal(classify(0.5), 'PARTIAL');
  assert.equal(classify(0.9), 'COPERNICUS-READY');
});

test('opportunity + serviceable reconstruct demand (±1 rounding)', () => {
  const e = scoreEvent({ catId: 'floods', openedISO: daysAgo(1) }, [scene(2, 30)], NOW);
  assert.ok(Math.abs(e.opportunity + e.serviceable - e.demand) <= 1);
  assert.ok(['TASKING GAP', 'PARTIAL', 'COPERNICUS-READY'].includes(e.cls));
});
