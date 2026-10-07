// fetch helpers with timeout + retry. Isomorphic (global fetch/AbortController).

async function request(url, { method = 'GET', body, timeoutMs = 20000, retries = 2, as = 'json' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return as === 'text' ? await res.text() : await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export const fetchJson = (url, opts) => request(url, { ...opts, as: 'json' });
export const fetchText = (url, opts) => request(url, { ...opts, as: 'text' });

export async function pool(items, concurrency, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
