import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRss } from '../src/sources/gdacs.mjs';
import { parseFeed } from '../src/sources/usgs.mjs';
import { parseActivations } from '../src/sources/cems.mjs';
import { parseEvents } from '../src/sources/eonet.mjs';
import { SOURCES } from '../src/sources/index.mjs';

const NOW = Date.parse('2026-10-07T00:00:00Z');

test('every registered source has id, label and fetchEvents', () => {
  for (const s of SOURCES) {
    assert.equal(typeof s.id, 'string');
    assert.equal(typeof s.label, 'string');
    assert.equal(typeof s.fetchEvents, 'function');
  }
});

test('GDACS RSS: newest episode per event, bbox filter, entity decoding', () => {
  const item = (ep, lat, lng, country = 'Portugal') => `<item><title>Green flood alert in ${country} &amp; more</title>
    <link>https://gdacs.org/x</link><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate>
    <gdacs:fromdate>Sun, 04 Oct 2026 10:00:00 GMT</gdacs:fromdate><gdacs:eventtype>FL</gdacs:eventtype>
    <gdacs:alertlevel>Green</gdacs:alertlevel><gdacs:eventid>77</gdacs:eventid><gdacs:episodeid>${ep}</gdacs:episodeid>
    <gdacs:country>${country}</gdacs:country><georss:point>${lat} ${lng}</georss:point></item>`;
  const rss = `<rss>${item(1, 39, -8)}${item(3, 39.1, -8)}${item(1, -10, 120, 'Elsewhere').replace('>77<', '>78<')}</rss>`;
  const all = parseRss(rss);
  assert.equal(all.length, 2);
  const pt = all.find((e) => e.eventId === 'GDACS_77');
  assert.equal(pt.id, 'GDACS_77_3');
  assert.equal(pt.catId, 'floods');
  assert.equal(pt.prior, 0.5);
  assert.equal(pt.alertTitle, 'Green flood alert in Portugal & more');
  assert.equal(parseRss(rss, { bbox: [-30, 30, 50, 72] }).length, 1);
});

test('USGS: keeps significant quakes, maps PAGER alert to prior', () => {
  const f = (id, mag, alert = null, ageD = 1) => ({
    id, type: 'Feature', geometry: { type: 'Point', coordinates: [20, 38, 10] },
    properties: { type: 'earthquake', mag, alert, time: NOW - ageD * 86_400_000, place: '10 km SW of Patras, Greece', url: 'u' },
  });
  const out = parseFeed({ features: [f('a', 6.1, 'orange'), f('b', 4.7), f('c', 4.8, 'yellow'), f('d', 7, null, 90), f('e', 5.1, 'green')] }, { nowMs: NOW, days: 45 });
  assert.deepEqual(out.map((e) => e.id), ['USGS_a', 'USGS_c']);
  assert.equal(out[0].prior, 0.9);
  assert.equal(out[0].title, 'Earthquake M6.1, Patras, Greece');
});

test('CEMS: open activations kept, sensitive dropped, centroid parsed', () => {
  const a = (code, o = {}) => ({ code, name: `Flood ${code}`, category: { slug: 'flood' }, countries: [{ short_name: 'Greece' }],
    centroid: 'POINT (24.97 35.22)', activationTime: '2026-10-04T11:02:00', lastUpdate: '2026-10-06T20:00:00', closed: false, ...o });
  const out = parseActivations({ results: [a('EMSR1'), a('EMSR2', { sensitive: true }), a('EMSR3', { closed: true, activationTime: '2026-01-01T00:00:00', lastUpdate: '2026-01-05T00:00:00' })] }, { nowMs: NOW });
  assert.equal(out.length, 1);
  assert.equal(out[0].activation, 'EMSR1');
  assert.equal(out[0].catId, 'floods');
  assert.equal(out[0].lng, 24.97);
  assert.equal(out[0].prior, 1.0);
});

test('EONET: newest geometry point, EO categories only', () => {
  const data = { events: [
    { id: 'E1', title: 'Fire', categories: [{ id: 'wildfires' }], geometry: [{ date: '2026-10-01T00:00:00Z', coordinates: [1, 2] }, { date: '2026-10-03T00:00:00Z', coordinates: [3, 4] }] },
    { id: 'E2', title: 'Iceberg', categories: [{ id: 'not-eo' }], geometry: [{ date: '2026-10-03T00:00:00Z', coordinates: [3, 4] }] },
  ] };
  const out = parseEvents(data, { nowMs: NOW, days: 30 });
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].lng, out[0].lat, out[0].openedISO], [3, 4, '2026-10-01T00:00:00Z']);
});

test('GDACS: storms are named, links are entity-decoded', () => {
  const rss = `<rss><item><title>Green notification for tropical cyclone NINE-26</title>
    <link>https://www.gdacs.org/report.aspx?eventtype=TC&amp;eventid=1</link><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate>
    <gdacs:eventtype>TC</gdacs:eventtype><gdacs:alertlevel>Green</gdacs:alertlevel><gdacs:eventid>1</gdacs:eventid>
    <gdacs:eventname>NINE-26</gdacs:eventname><gdacs:country>Mexico</gdacs:country><georss:point>22 -95</georss:point></item></rss>`;
  const [e] = parseRss(rss);
  assert.equal(e.title, 'Tropical cyclone NINE-26, Mexico');
  assert.equal(e.sources[0], 'https://www.gdacs.org/report.aspx?eventtype=TC&eventid=1');
});
