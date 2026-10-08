import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createRaiRouter } from '../server/rai/router.ts';

test('dispatches the original request to the selected guarded handler', async () => {
  for (const route of ['connection', 'analytics-snapshot']) {
    const calls = [];
    const req = { query: { route }, method: 'POST', headers: { authorization: 'Bearer synthetic' }, body: { action: 'inspect' } };
    const res = { setHeader(name, value) { assert.equal(name, 'Cache-Control'); assert.equal(value, 'no-store'); } };
    const router = createRaiRouter({ snapshot: (request, response) => calls.push(['analytics-snapshot', request, response]), connection: (request, response) => calls.push(['connection', request, response]) });
    await router(req, res);
    assert.deepEqual(calls, [[route, req, res]]);
  }
});

test('unknown and ambiguous routes never call either handler', () => {
  const router = createRaiRouter({ snapshot: () => assert.fail('unexpected snapshot'), connection: () => assert.fail('unexpected connection') });
  for (const route of [undefined, 'unknown', ['connection', 'analytics-snapshot']]) {
    const res = { setHeader() {}, status(code) { assert.equal(code, 404); return this; }, json(body) { assert.deepEqual(body, { error: 'Rai endpoint not found.' }); } };
    router({ headers: {}, query: { route } }, res);
  }
});

test('deployment keeps legacy URLs and stays within the Hobby function limit', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.rewrites[0], { source: '/api/rai/:route(analytics-snapshot|connection)', destination: '/api/rai?route=:route' });
  const entries = readdirSync(new URL('../api/', import.meta.url), { recursive: true }).filter(name => name.endsWith('.ts'));
  assert.equal(entries.length, 12);
  assert.ok(!entries.some(name => name.includes('_shared') || name.includes('delegation')));
});
