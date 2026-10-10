import { createHmac, timingSafeEqual } from 'node:crypto';

export function signServiceBody(body: string, timestamp: string, secret: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}
export function verifyServiceBody(body: string, headers: Record<string, string | string[] | undefined>, config: { secret: string; keyId: string }, now = Date.now()) {
  if (!config.secret || config.secret.length < 32 || !config.keyId) throw new Error('HealthPass service integration is not configured');
  const timestamp = headers['x-ecosystem-timestamp'];
  const signature = headers['x-ecosystem-signature'];
  if (headers['x-ecosystem-key-id'] !== config.keyId || typeof timestamp !== 'string' || !/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp) * 1000) > 300000 || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) throw new Error('Invalid service authentication');
  const expected = Buffer.from(signServiceBody(body, timestamp, config.secret), 'hex');
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new Error('Invalid service authentication');
}
