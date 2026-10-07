// Guardrail: src/core runs in the browser too, so it must not touch Node APIs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const dir = new URL('../src/core/', import.meta.url);

test('src/core has no Node-only imports or globals', async () => {
  for (const f of await readdir(dir)) {
    const src = await readFile(new URL(f, dir), 'utf8');
    assert.doesNotMatch(src, /from ['"]node:|require\(|\bprocess\.|\bBuffer\b/, `${f} must stay isomorphic`);
    for (const [, spec] of src.matchAll(/from ['"]([^'"]+)['"]/g)) assert.match(spec, /^\.\/[\w-]+\.mjs$/, `${f}: only sibling imports (${spec})`);
  }
});
