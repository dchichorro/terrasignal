import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const CACHE_DIR = process.env.TERRASIGNAL_CACHE_DIR ?? new URL('../../.cache/', import.meta.url).pathname;
const inflight = new Map(); // key → Promise: concurrent callers share one upstream fetch

function pathOf(key) {
  return `${CACHE_DIR.replace(/\/?$/, '/')}${createHash('sha1').update(key).digest('hex')}.json`;
}

async function save(file, data) {
  const payload = JSON.stringify({ t: Date.now(), data });
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, payload);
  } catch {
    /* cache is best-effort */
  }
}

/**
 * Disk cache with TTL, stale-on-error and single-flight: if the loader fails,
 * the last good value is served, so demos survive upstream blips.
 */
export function cached(key, ttlMs, loader, { allowStale = true } = {}) {
  if (inflight.has(key)) return inflight.get(key);
  const p = load(key, ttlMs, loader, allowStale).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function load(key, ttlMs, loader, allowStale) {
  const file = pathOf(key);
  let entry = null;
  try {
    entry = JSON.parse(await readFile(file, 'utf8'));
    if (Date.now() - entry.t < ttlMs) return entry.data;
  } catch {
    /* miss */
  }
  try {
    const data = await loader();
    await save(file, data);
    return data;
  } catch (err) {
    if (allowStale && entry) return entry.data;
    throw err;
  }
}
