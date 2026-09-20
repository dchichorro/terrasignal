import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const CACHE_DIR = new URL('../.cache/', import.meta.url).pathname;

function pathOf(key) {
  return `${CACHE_DIR}${createHash('sha1').update(key).digest('hex')}.json`;
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

export async function cached(key, ttlMs, loader, { allowStale = true } = {}) {
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
