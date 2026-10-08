import type { HandlerRequest, HandlerResponse, Database, User } from '../_shared.js';
import type { createDelegationService } from './delegation.js';
import type { resolveRaiAccessScope, RaiCapability } from './access-policy.js';

type Dependencies = {
  getService: () => ReturnType<typeof createDelegationService>;
  consentOrigin: () => string | undefined;
  isServiceAuthorized: (request: HandlerRequest) => boolean;
  getCookieToken: (request: HandlerRequest) => string;
  hashToken: (token: string) => string;
  resolveTenant: (slug: string) => Promise<{ slug: string; db: Database } | null>;
  authenticate: (request: HandlerRequest, db: Database) => Promise<User | null>;
  resolveAccess: typeof resolveRaiAccessScope;
};

export function createConnectionHandler(deps: Dependencies) {
  return async (req: HandlerRequest, res: HandlerResponse) => {
    const fail = (status: number, message: string) => res.status(status).json({ error: message });
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(405, 'Use POST.'); }
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || JSON.stringify(req.body).length > 8192) throw badRequest('Invalid request.');
      const body = req.body as Record<string, unknown>;
      if (!['authorize', 'exchange', 'inspect', 'revoke'].includes(String(body.action))) throw badRequest('Unknown connection action.');
      if (body.action !== 'authorize' && !deps.isServiceAuthorized(req)) return fail(401, 'Unauthorized');
      const service = deps.getService();
      if (body.action === 'authorize') {
        const origin = deps.consentOrigin();
        if (!origin || !origin.startsWith('https://') || req.headers.origin !== origin || !deps.getCookieToken(req) || body.confirmed !== true) return fail(403, 'Signed-in, same-origin consent is required.');
        const tenant = await deps.resolveTenant(requiredText(body.tenant_id));
        if (!tenant) return fail(404, 'Workspace not found');
        // Consent must use the browser identity, never a supplied bearer identity.
        const user = await deps.authenticate({ headers: { cookie: req.headers.cookie } }, tenant.db);
        if (!user) return fail(401, 'Sign in to RxLedger first.');
        const access = deps.resolveAccess({ db: tenant.db, user, requestedBranchIds: stringList(body.branch_ids), requiredCapabilities: stringList(body.capabilities) as RaiCapability[] });
        if (!access.ok) return fail(403, access.reason);
        const result = await service.authorize({
          scope: { tenantId: tenant.slug, userId: user.id, sessionHash: deps.hashToken(deps.getCookieToken(req)), branchIds: access.branchIds, capabilities: access.capabilities },
          redirectUri: requiredText(body.redirect_uri), challenge: requiredText(body.code_challenge), challengeMethod: requiredText(body.code_challenge_method)
        });
        return res.status(200).json({ data: result });
      }
      if (body.action === 'exchange') return res.status(200).json({ data: await service.exchange({ code: requiredText(body.code), verifier: requiredText(body.code_verifier), redirectUri: requiredText(body.redirect_uri) }) });
      const token = requiredText(body.access_token);
      if (body.action === 'revoke') {
        await service.revoke(token);
        return res.status(200).json({ data: { revoked: true } });
      }
      const scope = await service.inspect(token);
      const tenant = await deps.resolveTenant(scope.tenantId);
      const user = tenant?.db.users.find(item => item.id === scope.userId);
      if (!tenant || !user) return fail(401, 'Connection is no longer available.');
      const access = deps.resolveAccess({ db: tenant.db, user, requestedBranchIds: scope.branchIds, requiredCapabilities: scope.capabilities });
      if (!access.ok) return fail(403, access.reason);
      return res.status(200).json({ data: { tenantId: tenant.slug, userId: user.id, role: user.role, branchIds: access.branchIds, capabilities: access.capabilities } });
    } catch (error) {
      const status = Number((error as { status?: number }).status) || 500;
      return fail(status, status >= 500 ? 'Rai connection is unavailable.' : (error as Error).message);
    }
  };
}

function badRequest(message: string) { return Object.assign(new Error(message), { status: 400 }); }
function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 1024) throw badRequest('Invalid connection field.');
  return value;
}
function stringList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 20 || value.some(item => typeof item !== 'string' || !item || item.length > 128)) throw badRequest('Explicit branches and capabilities are required.');
  return [...new Set(value)];
}
