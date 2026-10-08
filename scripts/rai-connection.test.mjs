import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConnectionHandler } from '../server/rai/connection-handler.ts';
import { resolveRaiAccessScope } from '../server/rai/access-policy.ts';

const user = { id: 'u', role: 'inventory', status: 'active', branchIds: ['b'], managedBranchIds: [] };
const db = { users: [user], branches: [{ id: 'b', active: true }], settings: {} };
const scope = { tenantId: 'tenant', userId: 'u', sessionHash: 'private-hash', branchIds: ['b'], capabilities: ['inventory_analytics'] };
function fixture(overrides = {}) {
  const issued = [];
  const service = {
    async authorize(input) { issued.push(input); return { code: 'one-use-code' }; },
    async inspect() { return scope; }, async exchange() { return { accessToken: 'token' }; }, async revoke() {}
  };
  const handler = createConnectionHandler({
    getService: () => service, consentOrigin: () => 'https://rxledger.example',
    isServiceAuthorized: request => request.headers.authorization === 'Bearer service',
    getCookieToken: request => request.headers.cookie ? 'parent-session' : '',
    hashToken: () => 'private-hash', resolveTenant: async () => ({ slug: 'tenant', db }),
    authenticate: async request => { assert.equal(request.headers.authorization, undefined); return user; },
    resolveAccess: resolveRaiAccessScope, ...overrides
  });
  return { issued, async call(body, headers = {}, method = 'POST') {
    const res = { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, setHeader(key, value) { this.headers[key] = value; }, json(value) { this.body = value; } };
    await handler({ method, body, headers }, res);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    return res;
  } };
}
const consent = { action: 'authorize', confirmed: true, tenant_id: 'tenant', branch_ids: ['b'], capabilities: ['inventory_analytics'], redirect_uri: 'https://rai.example/callback', code_challenge: 'challenge', code_challenge_method: 'S256' };
const browser = { origin: 'https://rxledger.example', cookie: 'session', authorization: 'Bearer spoofed' };
test('consent requires RxLedger origin, cookie and explicit approval', async () => {
  const app = fixture();
  for (const headers of [{}, { ...browser, origin: 'https://evil.example' }, { origin: browser.origin }]) assert.equal((await app.call(consent, headers)).statusCode, 403);
  assert.equal((await app.call({ ...consent, confirmed: false }, browser)).statusCode, 403);
  assert.equal(app.issued.length, 0);
  assert.equal((await app.call(consent, browser)).statusCode, 200);
  assert.deepEqual(app.issued[0].scope, scope);
});
test('consent rejects missing session, forbidden branches and capability escalation', async () => {
  assert.equal((await fixture({ authenticate: async () => null }).call(consent, browser)).statusCode, 401);
  for (const change of [{ branch_ids: ['other'] }, { capabilities: ['financial_analytics'] }]) assert.equal((await fixture().call({ ...consent, ...change }, browser)).statusCode, 403);
});
test('machine actions require the service credential', async () => {
  for (const action of ['inspect', 'exchange', 'revoke']) assert.equal((await fixture().call({ action, access_token: 'token' }, browser)).statusCode, 401);
});
test('inspection rechecks live permissions and excludes session metadata', async () => {
  const result = await fixture().call({ action: 'inspect', access_token: 'token' }, { authorization: 'Bearer service' });
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.stringify(result.body).includes('private-hash'), false);
  const blocked = fixture({ resolveTenant: async () => ({ slug: 'tenant', db: { ...db, users: [{ ...user, status: 'suspended' }] } }) });
  assert.equal((await blocked.call({ action: 'inspect', access_token: 'token' }, { authorization: 'Bearer service' })).statusCode, 403);
});
test('fails closed when disabled and rejects bad methods or input', async () => {
  const disabled = fixture({ getService: () => { throw Object.assign(new Error('sensitive configuration'), { status: 503 }); } });
  const result = await disabled.call({ action: 'inspect' }, { authorization: 'Bearer service' });
  assert.equal(result.statusCode, 503);
  assert.equal(JSON.stringify(result.body).includes('sensitive'), false);
  const app = fixture();
  assert.equal((await app.call({}, {}, 'GET')).statusCode, 405);
  assert.equal((await app.call({ action: 'unknown' })).statusCode, 400);
  assert.equal((await app.call({ ...consent, branch_ids: [] }, browser)).statusCode, 400);
});
