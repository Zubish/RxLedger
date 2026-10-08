import { getAuthenticatedUser, getCookieToken, hashToken, resolveTenantWorkspace } from '../_shared.js';
import { resolveRaiAccessScope } from './access-policy.js';
import { createDelegationService } from './delegation.js';
import { createDelegationStore } from './delegation-store.js';
import { isRaiServiceAuthorized } from './service-auth.js';
import { createConnectionHandler } from './connection-handler.js';

export function getDelegationService() {
  if (process.env.RAI_DELEGATION_ENABLED !== 'true' || !process.env.RAI_REDIRECT_URI) {
    throw Object.assign(new Error('Rai connection is not enabled.'), { status: 503 });
  }
  return createDelegationService({ store: createDelegationStore(), redirectUri: process.env.RAI_REDIRECT_URI });
}

export default createConnectionHandler({
  getService: getDelegationService,
  consentOrigin: () => process.env.RXLEDGER_APP_ORIGIN,
  isServiceAuthorized: isRaiServiceAuthorized,
  getCookieToken, hashToken,
  resolveTenant: resolveTenantWorkspace,
  authenticate: getAuthenticatedUser,
  resolveAccess: resolveRaiAccessScope
});
