import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demandScore, supplyStats, sarStats, combinedSupply, scoreEvent, classify, gapReason } from '../src/core/score.mjs';

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

test('a Copernicus EMS activation raises demand', () => {
  const e = { catId: 'floods', prior: 0.7, openedISO: daysAgo(3) };
  assert.ok(demandScore({ ...e, activation: 'EMSR1' }, NOW) > demandScore(e, NOW));
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

test('SAR supply ignores cloud and decays with age', () => {
  assert.equal(sarStats([], NOW).sarSupply, 0);
  const fresh = sarStats([{ dt: daysAgo(1) }], NOW).sarSupply;
  const old = sarStats([{ dt: daysAgo(20) }], NOW).sarSupply;
  assert.ok(fresh > 0.8 && old < 0.2);
});

test('SAR lifts cloudy flood supply far more than cloudy wildfire supply', () => {
  const flood = combinedSupply(0.2, 0.9, 'floods');
  const fire = combinedSupply(0.2, 0.9, 'wildfires');
  assert.ok(flood > 0.85, `flood=${flood}`);
  assert.ok(fire < 0.55, `fire=${fire}`);
  assert.ok(Math.abs(combinedSupply(0.3, 0, 'floods') - 0.3) < 1e-9); // no SAR → optical only
});

test('opportunity + serviceable reconstruct demand (±2 rounding)', () => {
  for (const catId of ['floods', 'earthquake', 'drought']) {
    const e = scoreEvent({ catId, openedISO: daysAgo(1) }, [scene(2, 30)], NOW, { sarScenes: [{ dt: daysAgo(1) }] });
    assert.ok(Math.abs(e.opportunity + e.serviceable - e.demand) <= 2, `${catId}: ${JSON.stringify(e)}`);
    assert.ok(Math.abs(e.coverageGap + e.resolutionGap - e.opportunity) <= 1);
  }
});

test('earthquakes keep a VHR resolution gap even when free data is fresh and clear', () => {
  const scenes = [scene(0.5, 2), scene(3, 3)];
  const quake = scoreEvent({ catId: 'earthquake', openedISO: daysAgo(1) }, scenes, NOW);
  const drought = scoreEvent({ catId: 'drought', openedISO: daysAgo(1) }, scenes, NOW);
  assert.equal(quake.cls, 'COPERNICUS-READY');
  assert.ok(quake.resolutionGap > quake.coverageGap);
  assert.ok(quake.resolutionGap > 3 * drought.resolutionGap);
});

test('gap reason names the shortfall', () => {
  assert.equal(gapReason({ count: 0 }), 'no-pass');
  assert.equal(gapReason({ count: 2, lastAgeDays: 15, medianCloud: 5 }), 'stale');
  assert.equal(gapReason({ count: 2, lastAgeDays: 2, medianCloud: 80 }), 'cloud');
  assert.equal(gapReason({ count: 2, lastAgeDays: 2, medianCloud: 10 }), null);
});
