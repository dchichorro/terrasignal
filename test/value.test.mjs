import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, dealSize, toLead, pipelineTotals, PRICEBOOK, fmtEUR } from '../src/core/value.mjs';

test('cloud-blocked flood gap recommends SAR tasking', () => {
  assert.equal(recommend({ cls: 'TASKING GAP', catId: 'floods', gapReason: 'cloud' }).key, 'sarTasking');
});

test('cyclone gap recommends SAR even without measured cloud', () => {
  assert.equal(recommend({ cls: 'TASKING GAP', catId: 'severe-storms', gapReason: 'no-pass' }).key, 'sarTasking');
});

test('wildfire gap recommends VHR optical (SAR is weak for burn severity)', () => {
  assert.equal(recommend({ cls: 'TASKING GAP', catId: 'wildfires', gapReason: 'cloud' }).key, 'vhrOptical');
});

test('covered earthquake still recommends VHR damage assessment', () => {
  assert.equal(recommend({ cls: 'COPERNICUS-READY', catId: 'earthquake' }).key, 'vhrDamage');
});

test('ready event carried by SAR recommends Sentinel-1 analytics', () => {
  const r = recommend({ cls: 'COPERNICUS-READY', catId: 'floods', opticalSupply: 0.3, sarSupply: 0.9, supply: 0.93 });
  assert.equal(r.key, 'freeSarAnalytics');
});

test('deal size honours minimum orders and per-scene pricing', () => {
  const vhr = { key: 'vhrOptical', ...PRICEBOOK.vhrOptical };
  assert.equal(dealSize(vhr, 10), PRICEBOOK.vhrOptical.minKm2 * PRICEBOOK.vhrOptical.perKm2);
  const sar = { key: 'sarTasking', ...PRICEBOOK.sarTasking };
  assert.equal(dealSize(sar, 250), 3 * PRICEBOOK.sarTasking.perScene);
});

test('toLead weights deal by the matching score share', () => {
  const lead = toLead({ cls: 'TASKING GAP', catId: 'wildfires', opportunity: 50, serviceable: 10 });
  assert.equal(lead.radiusKm, 15);
  assert.equal(lead.weightedEUR, Math.round(lead.dealEUR * 0.5));
  const totals = pipelineTotals([lead, { recommendation: { motion: 'analytics' }, weightedEUR: 100 }]);
  assert.equal(totals.totalEUR, lead.weightedEUR + 100);
});

test('fmtEUR', () => {
  assert.equal(fmtEUR(950), '€950');
  assert.equal(fmtEUR(12_400), '€12k');
  assert.equal(fmtEUR(2_340_000), '€2.3M');
});
