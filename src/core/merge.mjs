// Fuse demand feeds into one event list. Pure and isomorphic.

const SOURCE_RANK = { CEMS: 0, GDACS: 1, USGS: 2, EONET: 3 }; // official/tasking-backed first

const kmApart = (a, b) =>
  111.32 * Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((b.lat * Math.PI) / 180));

/**
 * Two reports are the same event when they are close in space and either share
 * a hazard category or sit almost on top of each other (cross-taxonomy feeds).
 */
export function isSameEvent(a, b) {
  const d = kmApart(a, b);
  return (a.catId === b.catId && d < 220) || d < 60;
}

/**
 * Merge events from several feeds. Higher-ranked sources win conflicts (GDACS
 * has severity; CEMS has confirmed tasking); the loser contributes magnitude and
 * provenance. Events opened before the window are dropped (future-dated kept:
 * feed clocks drift).
 */
export function mergeDemand(feeds, nowMs, days) {
  const cutoff = nowMs - days * 86_400_000;
  const all = feeds
    .flat()
    .filter((e) => e && Number.isFinite(e.lat) && Number.isFinite(e.lng))
    .filter((e) => {
      const t = Date.parse(e.openedISO);
      return t > nowMs || t >= cutoff;
    })
    .sort((a, b) => (SOURCE_RANK[a.src] ?? 9) - (SOURCE_RANK[b.src] ?? 9));
  const out = [];
  for (const e of all) {
    const dup = out.find((o) => isSameEvent(o, e));
    if (dup) {
      dup.mergedFrom = [...new Set([...(dup.mergedFrom ?? [dup.src]), e.src])];
      dup.magnitudeValue ??= e.magnitudeValue;
      dup.magnitudeUnit ??= e.magnitudeUnit;
      dup.activation ??= e.activation;
      dup.sources = [...new Set([...(dup.sources ?? []), ...(e.sources ?? [])])].slice(0, 4);
      // a CEMS activation on top of a feed event: keep the feed's onset time
      if (Date.parse(e.openedISO) < Date.parse(dup.openedISO)) dup.openedISO = e.openedISO;
      continue;
    }
    out.push({ ...e });
  }
  return out;
}
