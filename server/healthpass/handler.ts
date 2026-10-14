import { verifyServiceBody } from './auth.js';
import { integrationState, receivePrescription, receivePrescriptionControl, type PartnerScope } from './workflow.js';
import { loadTenantDatabase, saveTenantDatabase, requireMethod, fail, type HandlerRequest, type HandlerResponse } from '../_shared.js';

export async function rawBody(req: HandlerRequest & AsyncIterable<Uint8Array>, limit = 262144): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Integration request is too large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
function partnerScope(): PartnerScope {
  const scope = { sourceOrganizationId: process.env.HEALTHPASS_SOURCE_ORGANIZATION_ID || '', tenantId: process.env.HEALTHPASS_PHARMACY_TENANT_ID || '', branchId: process.env.HEALTHPASS_PHARMACY_BRANCH_ID || '' };
  if (Object.values(scope).some(value => !value)) throw new Error('HealthPass partner scope is not configured');
  return scope;
}
export default async function handler(req: HandlerRequest & AsyncIterable<Uint8Array>, res: HandlerResponse) {
  res.setHeader('Cache-Control','no-store');
  if (!requireMethod(req,res,['POST'])) return;
  try {
    const raw = await rawBody(req);
    if (Buffer.byteLength(raw) > 262144) throw new Error('Integration request is too large');
    verifyServiceBody(raw, req.headers, { secret: process.env.HEALTHPASS_SERVICE_SECRET || '', keyId: process.env.HEALTHPASS_SERVICE_KEY_ID || '' });
    const scope = partnerScope(), body = JSON.parse(raw);
    const db = await loadTenantDatabase(scope.tenantId);
    if (!db) throw new Error('Assigned pharmacy tenant not found');
    if (body.action === 'pullEvents') {
      const events = integrationState(db).outbox.filter(row => !row.acknowledgedAt && db.healthpass?.prescriptions.some(p => p.prescription.prescriptionId === row.event.aggregateId && p.sourceOrganizationId === scope.sourceOrganizationId && p.prescription.pharmacy.branchId === scope.branchId)).slice(0,100).map(row => row.event);
      res.status(200).json({ events }); return;
    }
    let result: unknown;
    if (body.action === 'receivePrescription') result = receivePrescription(db,body.event,scope);
    else if (body.action === 'receivePrescriptionControl') result = receivePrescriptionControl(db,body.event,scope);
    else if (body.action === 'acknowledgeEvents') {
      if (!Array.isArray(body.eventIds) || !body.eventIds.length || body.eventIds.length > 100 || body.eventIds.some((id: unknown) => typeof id !== 'string')) throw new Error('Invalid feedback acknowledgement');
      for (const eventId of body.eventIds) {
        const row = integrationState(db).outbox.find(item => item.event.eventId === eventId);
        if (!row || !db.healthpass?.prescriptions.some(p => p.prescription.prescriptionId === row.event.aggregateId && p.sourceOrganizationId === scope.sourceOrganizationId && p.prescription.pharmacy.branchId === scope.branchId)) throw new Error('Feedback event outside partner scope');
        row.acknowledgedAt ||= new Date().toISOString();
      }
      result = { acknowledged:body.eventIds.length };
    } else throw new Error('Unknown integration action');
    await saveTenantDatabase(scope.tenantId,db);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Integration request failed';
    fail(res, /authentication/.test(message) ? 401 : /concurrently/.test(message) ? 409 : 400, message);
  }
}
