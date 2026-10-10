import type { Database } from '../_shared.js';
import { signServiceBody } from './auth.js';

export async function assertLiveAuthorization(db: Database, raw: unknown, timeoutMs = 8000) {
  const link = raw as { prescriptionId: string; version: number };
  const record = db.healthpass?.prescriptions.find(row => row.prescription.prescriptionId === link.prescriptionId && row.prescription.version === link.version);
  if (!record || record.inactive) throw new Error('Prescription is inactive or unavailable');
  const endpoint = process.env.HEALTHPASS_AUTHORIZATION_URL;
  if (!endpoint) {
    if (process.env.NODE_ENV === 'production') throw new Error('Live HealthPass authorization is required before dispensing');
    return;
  }
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('HealthPass authorization requires HTTPS');
  const secret = process.env.HEALTHPASS_SERVICE_SECRET || '';
  const keyId = process.env.HEALTHPASS_SERVICE_KEY_ID || '';
  if (secret.length < 32 || !keyId) throw new Error('HealthPass service authentication is not configured');
  const body = JSON.stringify({ prescriptionId: link.prescriptionId, version: link.version, patientLinkId: record.prescription.patientLinkId });
  const timestamp = String(Math.floor(Date.now()/1000));
  const response = await fetch(url, { method: 'POST', headers: { 'content-type':'application/json', 'x-ecosystem-timestamp':timestamp, 'x-ecosystem-key-id':keyId, 'x-ecosystem-signature':signServiceBody(body,timestamp,secret) }, body, signal: AbortSignal.timeout(timeoutMs), redirect:'error' });
  if (!response.ok) throw new Error('HealthPass authorization denied or unavailable; prescription was not dispensed');
  const authorization = await response.json() as { authorized?: unknown };
  if (authorization?.authorized !== true) throw new Error('HealthPass authorization denied or unavailable; prescription was not dispensed');
}

/** Filter only the response copy; pharmacy-owned recorded sales remain intact. */
export async function filterAuthorizedHealthPassContext(db: Database, authorize = assertLiveAuthorization) {
  if (!db.healthpass) return db;
  const response = { ...db, healthpass: { ...db.healthpass, prescriptions: [] as NonNullable<Database['healthpass']>['prescriptions'] } };
  const records = db.healthpass.prescriptions;
  const deadline = Date.now() + 3000;
  // Bound both concurrency and response size; inaccessible context fails closed.
  for (let start = 0; start < Math.min(records.length,100); start += 5) {
    if (Date.now() >= deadline) break;
    const batch = await Promise.all(records.slice(start,start+5).map(async record => {
      const p = record.prescription;
      if (record.inactive || Date.parse(p.validUntil) <= Date.now() || Date.parse(p.consent.expiresAt) <= Date.now()) return null;
      if (process.env.NODE_ENV === 'production' || process.env.HEALTHPASS_AUTHORIZATION_URL) {
        try { await authorize(db,{prescriptionId:p.prescriptionId,version:p.version},Math.max(1,deadline-Date.now())); } catch { return null; }
      }
      return structuredClone(record);
    }));
    response.healthpass.prescriptions.push(...batch.filter((record): record is NonNullable<typeof record> => record !== null));
  }
  return response;
}
