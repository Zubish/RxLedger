import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { createDelegationService, assertGrantScope } from '../server/rai/delegation.ts';

const verifier = 'a'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');
const redirectUri = 'https://rai.example/api/rai/connection/callback';
const scope = { tenantId: 'tenant-a', userId: 'user-a', sessionHash: 'parent-session-hash', branchIds: ['branch-a'], capabilities: ['inventory_analytics'] };
function setup() {
  const codes = new Map(), grants = new Map();
  let now = 1000, active = true;
  const store = {
    async saveCode(key, value) { codes.set(key, value); },
    async takeCode(key) { const value = codes.get(key); codes.delete(key); return value; },
    async saveGrant(key, value) { grants.set(key, value); },
    async getGrant(key) { return grants.get(key); },
    async revokeGrant(key) { grants.delete(key); },
    async sessionActive() { return active; }
  };
  const service = createDelegationService({ store, redirectUri, now: () => now });
  return { service, codes, grants, tick: n => { now += n; }, logout: () => { active = false; } };
}
async function authorize(service) {
  return service.authorize({ scope, redirectUri, challenge, challengeMethod: 'S256' });
}
test('exchange binds a single-use code to PKCE and stores only token hashes', async () => {
  const { service, codes, grants } = setup();
  const { code } = await authorize(service);
  assert.equal(codes.has(code), false);
  const result = await service.exchange({ code, verifier, redirectUri });
  assert.equal(grants.has(result.accessToken), false);
  assert.equal((await service.inspect(result.accessToken)).tenantId, 'tenant-a');
  await assert.rejects(service.exchange({ code, verifier, redirectUri }), /Invalid/);
});
test('rejects wrong verifier, redirect, plain PKCE and expired codes', async () => {
  const { service, tick } = setup();
  await assert.rejects(service.authorize({ scope, redirectUri: 'https://evil.example', challenge, challengeMethod: 'S256' }));
  await assert.rejects(service.authorize({ scope, redirectUri, challenge, challengeMethod: 'plain' }));
  let { code } = await authorize(service);
  await assert.rejects(service.exchange({ code, verifier: 'b'.repeat(43), redirectUri }), /Invalid/);
  ({ code } = await authorize(service));
  await assert.rejects(service.exchange({ code, verifier, redirectUri: 'https://evil.example' }), /Invalid/);
  tick(120001);
  await assert.rejects(service.exchange({ code, verifier, redirectUri }), /Invalid/);
});
test('parent logout blocks exchange and grants; disconnect and expiry revoke access', async () => {
  const first = setup();
  const { code } = await authorize(first.service);
  first.logout();
  await assert.rejects(first.service.exchange({ code, verifier, redirectUri }), /Invalid/);
  for (const action of ['logout', 'revoke', 'expire']) {
    const fixture = setup();
    const { code } = await authorize(fixture.service);
    const { accessToken } = await fixture.service.exchange({ code, verifier, redirectUri });
    if (action === 'logout') fixture.logout();
    if (action === 'revoke') await fixture.service.revoke(accessToken);
    if (action === 'expire') fixture.tick(900001);
    await assert.rejects(fixture.service.inspect(accessToken), /Invalid/);
  }
});
test('only one concurrent exchange succeeds', async () => {
  const { service } = setup();
  const { code } = await authorize(service);
  const results = await Promise.allSettled([1, 2].map(() => service.exchange({ code, verifier, redirectUri })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
});
test('consent does not permit broader tenant, user, branch or capabilities', () => {
  const request = { tenantId: 'tenant-a', userId: 'user-a', branchIds: ['branch-a'], capabilities: ['inventory_analytics'] };
  assert.doesNotThrow(() => assertGrantScope(scope, request));
  for (const change of [{ tenantId: 'tenant-b' }, { userId: 'user-b' }, { branchIds: ['branch-b'] }, { capabilities: ['financial_analytics'] }, { branchIds: [] }, { capabilities: [] }]) {
    assert.throws(() => assertGrantScope(scope, { ...request, ...change }));
  }
});
