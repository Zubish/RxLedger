import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RaiCapability } from './access-policy.js';

export type GrantScope = {
  tenantId: string; userId: string; sessionHash: string;
  branchIds: string[]; capabilities: RaiCapability[];
};
export type GrantRecord = { scope: GrantScope; expiresAt: number; audience: 'rai' };
export type CodeRecord = GrantRecord & { challenge: string; redirectUri: string };
export type DelegationStore = {
  saveCode(key: string, value: CodeRecord): Promise<void>;
  takeCode(key: string): Promise<CodeRecord | undefined>;
  saveGrant(key: string, value: GrantRecord): Promise<void>;
  getGrant(key: string): Promise<GrantRecord | undefined>;
  revokeGrant(key: string): Promise<void>;
  sessionActive(hash: string, userId: string): Promise<boolean>;
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const invalid = () => Object.assign(new Error('Invalid or expired Rai authorization.'), { status: 401 });
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

export function createDelegationService({ store, redirectUri, now = Date.now }: {
  store: DelegationStore; redirectUri: string; now?: () => number;
}) {
  const callback = new URL(redirectUri);
  if (callback.protocol !== 'https:' || callback.username || callback.password || callback.hash || callback.search) throw new Error('A fixed HTTPS Rai callback is required.');
  return {
    async authorize(input: { scope: GrantScope; redirectUri: string; challenge: string; challengeMethod: string }) {
      if (input.redirectUri !== redirectUri || input.challengeMethod !== 'S256' || !validToken(input.challenge) ||
          !input.scope.branchIds.length || !input.scope.capabilities.length ||
          !await store.sessionActive(input.scope.sessionHash, input.scope.userId)) throw invalid();
      const code = randomBytes(32).toString('base64url');
      await store.saveCode(hash(code), { scope: input.scope, challenge: input.challenge, redirectUri, audience: 'rai', expiresAt: now() + 120000 });
      return { code, expiresIn: 120 };
    },
    async exchange(input: { code: string; verifier: string; redirectUri: string }) {
      if (!validToken(input.code) || typeof input.verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(input.verifier) || input.redirectUri !== redirectUri) throw invalid();
      // Atomic removal prevents concurrent code replay across serverless instances.
      const record = await store.takeCode(hash(input.code));
      const challenge = createHash('sha256').update(input.verifier).digest('base64url');
      if (!record || record.audience !== 'rai' || record.expiresAt <= now() || record.redirectUri !== redirectUri ||
          !validToken(record.challenge) || !timingSafeEqual(Buffer.from(challenge), Buffer.from(record.challenge)) ||
          !await store.sessionActive(record.scope.sessionHash, record.scope.userId)) throw invalid();
      const accessToken = randomBytes(32).toString('base64url');
      await store.saveGrant(hash(accessToken), { scope: record.scope, audience: 'rai', expiresAt: now() + 900000 });
      return { accessToken, expiresIn: 900, tokenType: 'Bearer' };
    },
    async inspect(token: string) {
      if (!validToken(token)) throw invalid();
      const record = await store.getGrant(hash(token));
      if (!record || record.audience !== 'rai' || record.expiresAt <= now() ||
          !await store.sessionActive(record.scope.sessionHash, record.scope.userId)) throw invalid();
      return record.scope;
    },
    async revoke(token: string) {
      if (!validToken(token)) throw invalid();
      await store.revokeGrant(hash(token));
    }
  };
}

export function assertGrantScope(grant: GrantScope, request: Omit<GrantScope, 'sessionHash'>) {
  if (grant.tenantId !== request.tenantId || grant.userId !== request.userId ||
      !request.branchIds.length || !request.capabilities.length ||
      request.branchIds.some(id => !grant.branchIds.includes(id)) ||
      request.capabilities.some(capability => !grant.capabilities.includes(capability))) {
    throw Object.assign(new Error('Requested analysis exceeds Rai consent.'), { status: 403 });
  }
}
