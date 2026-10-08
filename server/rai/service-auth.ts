import { timingSafeEqual } from 'node:crypto';
import { getBearerToken } from '../_shared.js';
import type { HandlerRequest } from '../_shared.js';

export function isRaiServiceAuthorized(req: HandlerRequest) {
  const expected = process.env.RXLEDGER_RAI_API_KEY || process.env.RAI_API_KEY || process.env.RXLEDGER_API_KEY || '';
  const token = getBearerToken(req);
  if (!expected || !token) return false;
  const supplied = Buffer.from(token), known = Buffer.from(expected);
  return supplied.length === known.length && timingSafeEqual(supplied, known);
}
