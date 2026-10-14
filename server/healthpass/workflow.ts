import { createHash, randomUUID } from 'node:crypto';
import type { Database, User, Sale } from '../_shared.js';
import type { EcosystemEvent, HealthPassPrescription, HealthPassState, PharmacyPrescription } from '../../src/healthpassContracts.js';
import { accessibleBranchIds, primaryAdminIdForDatabase } from '../branch-scope.js';

export type PartnerScope = { sourceOrganizationId: string; tenantId: string; branchId: string };
function text(value: unknown, label: string, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid ${label}`);
  return value.trim();
}
function instant(value: unknown, label: string) {
  const result = text(value, label, 80);
  const parsed = Date.parse(result);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(result) || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0,19) !== result.slice(0,19)) throw new Error(`Invalid ${label}`);
  return result;
}
export function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function integrationState(db: Database): HealthPassState {
  return db.healthpass ??= { prescriptions: [], inbox: [], operations: [], outbox: [] };
}
export function validatePrescriptionEvent(raw: unknown, scope: PartnerScope, now = Date.now()): EcosystemEvent {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid prescription event');
  const event = raw as EcosystemEvent;
  if (event.schemaVersion !== 1 || event.eventType !== 'prescription.dispatched' || event.producer !== 'healthpass' || event.sourceOrganizationId !== scope.sourceOrganizationId) throw new Error('Unsupported or unauthorized prescription source');
  text(event.eventId, 'event ID', 160); text(event.correlationId, 'correlation ID', 160); instant(event.occurredAt, 'event time');
  if (Date.parse(event.occurredAt) > now + 300000) throw new Error('Event timestamp is in the future');
  const p = event.payload as unknown as HealthPassPrescription;
  if (!p || typeof p !== 'object') throw new Error('Invalid prescription');
  text(p.prescriptionId, 'prescription ID', 160);
  if (!Number.isSafeInteger(p.version) || p.version < 1 || event.aggregateId !== p.prescriptionId || event.aggregateVersion !== p.version) throw new Error('Invalid prescription version');
  if (p.pharmacy?.tenantId !== scope.tenantId || p.pharmacy?.branchId !== scope.branchId) throw new Error('Prescription outside authorized pharmacy scope');
  text(p.patientLinkId, 'verified patient link', 160); text(p.patient?.healthPassId, 'HealthPass patient ID', 160); text(p.patient?.name, 'patient name', 300);
  text(p.encounterId, 'encounter', 160); text(p.prescriber?.id, 'prescriber', 160); text(p.prescriber?.facilityId, 'prescriber facility', 160); text(p.prescriber?.verificationReference, 'professional verification', 300);
  if (p.prescriber.facilityId !== scope.sourceOrganizationId) throw new Error('Prescriber facility is outside partner scope');
  const signedAt = Date.parse(instant(p.signedAt, 'signature time'));
  const validUntil = Date.parse(instant(p.validUntil, 'validity'));
  if (signedAt > now + 300000 || validUntil <= now || validUntil <= signedAt) throw new Error('Prescription is expired or invalid');
  if (p.consent?.purpose !== 'prescription_fulfilment' || !Number.isSafeInteger(p.consent.version) || p.consent.version < 1 || Date.parse(instant(p.consent.expiresAt, 'consent expiry')) <= now) throw new Error('Invalid or expired prescription sharing grant');
  text(p.consent.grantId, 'sharing grant', 160);
  if (!Array.isArray(p.items) || p.items.length < 1 || p.items.length > 100) throw new Error('Prescription must contain 1–100 items');
  const ids = new Set<string>();
  for (const item of p.items) {
    text(item.id, 'prescription item', 160);
    if (ids.has(item.id)) throw new Error('Duplicate prescription item');
    ids.add(item.id);
    for (const key of ['name','form','strength','doseUnit','route','frequency','duration','dispensingUnit','instructions','substitutionPolicy'] as const) text(item[key], key);
    if (typeof item.dose === 'number') { if (!Number.isFinite(item.dose) || item.dose <= 0) throw new Error('Invalid prescribed dose'); }
    else text(item.dose, 'dose');
    if (!['not_permitted','prescriber_approval_required'].includes(item.substitutionPolicy)) throw new Error('Invalid substitution policy');
    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1000000) throw new Error('Invalid prescribed quantity');
  }
  return event;
}
function makeEvent(record: PharmacyPrescription, eventType: string, payload: Record<string, unknown>): EcosystemEvent {
  const p = record.prescription;
  return { eventId: randomUUID(), eventType, schemaVersion: 1, occurredAt: new Date().toISOString(), producer: 'rxledger', sourceOrganizationId: p.pharmacy.tenantId, correlationId: record.correlationId, aggregateId: p.prescriptionId, aggregateVersion: p.version, payload };
}
export function receivePrescription(db: Database, raw: unknown, scope: PartnerScope, now = Date.now()) {
  if (!raw || typeof raw !== "object") throw new Error("Invalid prescription event");
  const event = raw as EcosystemEvent;
  const candidate = event.payload as unknown as HealthPassPrescription;
  if (event.schemaVersion !== 1 || event.eventType !== "prescription.dispatched" || event.producer !== "healthpass" || event.sourceOrganizationId !== scope.sourceOrganizationId || candidate?.pharmacy?.tenantId !== scope.tenantId || candidate?.pharmacy?.branchId !== scope.branchId || candidate?.prescriber?.facilityId !== scope.sourceOrganizationId) throw new Error("Prescription outside authenticated partner scope");
  const state = integrationState(db), hash = digest(event);
  const prior = state.inbox.find(row => row.eventId === event.eventId);
  if (prior) {
    if (prior.digest !== hash) throw new Error('Event ID reused with changed content');
    return { duplicate: true, prescriptionId: event.aggregateId, version: event.aggregateVersion, status: 'acknowledged' };
  }
  validatePrescriptionEvent(raw, scope, now);
  const p = structuredClone(event.payload) as unknown as HealthPassPrescription;
  if (!db.branches.some(b => b.id === scope.branchId && b.active)) throw new Error('Assigned pharmacy branch is inactive');
  const existing = state.prescriptions.find(row => row.prescription.prescriptionId === p.prescriptionId);
  if (existing) throw new Error('Prescription already received; amendments require reconciled version workflow');
  const record: PharmacyPrescription = { prescription: p, sourceOrganizationId: scope.sourceOrganizationId, correlationId: event.correlationId, receivedAt: new Date(now).toISOString(), review: 'pending', mappings: [], supplied: {}, fulfilment: 'none' };
  state.prescriptions.push(record);
  state.inbox.push({ eventId: event.eventId, digest: hash });
  state.outbox.push({ event: makeEvent(record, 'prescription.acknowledged', { prescriptionId: p.prescriptionId, prescriptionVersion: p.version, patientLinkId: p.patientLinkId, sourceTenantId: scope.tenantId, sourceBranchId: scope.branchId, receivedAt: record.receivedAt }) });
  db.auditLogs.unshift({ id: randomUUID(), userId: 'service:healthpass', action: 'Received signed HealthPass prescription', entity: 'prescription', entityId: p.prescriptionId, createdAt: record.receivedAt });
  return { duplicate: false, prescriptionId: p.prescriptionId, version: p.version, status: 'acknowledged' };
}
export function assertPharmacyAccess(db: Database, actor: User, branchId: string, review = false) {
  const branches = accessibleBranchIds(actor, primaryAdminIdForDatabase(db));
  if (actor.status !== 'active' || (branches !== null && !branches.includes(branchId)) || (review && actor.role !== 'pharmacist')) throw new Error('Pharmacy prescription access denied');
}
function findPrescription(db: Database, id: unknown, version: unknown) {
  const record = integrationState(db).prescriptions.find(row => row.prescription.prescriptionId === id && row.prescription.version === version);
  if (!record) throw new Error('Prescription not found');
  return record;
}
export function assertMedicineMapping(db: Database, item: HealthPassPrescription["items"][number], medicineId: string) {
  const medicine = db.medicines.find(row => row.id === medicineId && row.active);
  if (!medicine) throw new Error("Mapped medicine is inactive or unavailable");
      const drugName = (value: string) => value.trim().toLowerCase().replace(/\s+/g,' ');
      if (![medicine.brandName,medicine.genericName].filter(Boolean).some(name => drugName(name) === drugName(item.name))) throw new Error('Drug identity mismatch requires prescriber clarification');
      if (item.dispensingUnit.toLowerCase() !== medicine.sellableUnit.toLowerCase()) throw new Error('Dispensing unit must match the medicine least sellable unit; conversion requires review');
      if (item.strength.trim().toLowerCase() !== medicine.strength.trim().toLowerCase() || item.form.trim().toLowerCase() !== medicine.form.trim().toLowerCase()) throw new Error('Strength/form mismatch requires prescriber clarification');
}
export function reviewPrescription(db: Database, actor: User, input: Record<string, unknown>) {
  const record = findPrescription(db, input.prescriptionId, input.version), p = record.prescription;
  assertPharmacyAccess(db, actor, p.pharmacy.branchId, true);
  if (record.inactive || Date.parse(p.validUntil) <= Date.now() || Date.parse(p.consent.expiresAt) <= Date.now()) throw new Error('Prescription or sharing grant is inactive or expired');
  if (record.fulfilment !== 'none') throw new Error('Dispensed prescription review is immutable');
  if (!['accepted','clarification_required','rejected'].includes(String(input.status))) throw new Error('Invalid pharmacy review status');
  const mappings = input.mappings;
  if (input.status === 'accepted') {
    if (!Array.isArray(mappings) || mappings.length !== p.items.length) throw new Error('Map every prescribed item before acceptance');
    const seen = new Set<string>(), medicines = new Set<string>();
    for (const mapping of mappings) {
      const item = p.items.find(row => row.id === mapping.prescriptionItemId);
      const medicine = db.medicines.find(row => row.id === mapping.medicineId && row.active);
      if (!item || !medicine || seen.has(item.id) || medicines.has(medicine.id)) throw new Error('Invalid or ambiguous medicine mapping');
      assertMedicineMapping(db, item, medicine.id);
      seen.add(item.id); medicines.add(medicine.id);
    }
    record.mappings = mappings.map(m => ({ prescriptionItemId: m.prescriptionItemId, medicineId: m.medicineId }));
  }
  record.review = input.status as PharmacyPrescription['review'];
  record.reviewedBy = actor.id; record.reviewedAt = new Date().toISOString(); record.note = typeof input.note === 'string' ? input.note.slice(0,2000) : '';
  integrationState(db).outbox.push({ event: makeEvent(record, 'prescription.reviewed', { prescriptionId: p.prescriptionId, prescriptionVersion: p.version, patientLinkId: p.patientLinkId, sourceTenantId: p.pharmacy.tenantId, sourceBranchId: p.pharmacy.branchId, status: record.review, pharmacistReference: actor.id, note: record.note }) });
  db.auditLogs.unshift({ id: randomUUID(), userId: actor.id, action: 'Reviewed HealthPass prescription', entity: 'prescription', entityId: p.prescriptionId, createdAt: record.reviewedAt });
}
export type DispenseLink = { prescriptionId: string; version: number; operationId: string; items: { prescriptionItemId: string; medicineId: string; quantity: number }[] };
export function prepareDispense(db: Database, actor: User, branchId: string, raw: unknown, cartItems: { itemType: string; itemId: string; quantity: number }[], now = Date.now()) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid prescription dispense link');
  const link = raw as DispenseLink;
  text(link.operationId, 'dispense operation ID', 160);
  const record = findPrescription(db, link.prescriptionId, link.version), p = record.prescription;
  assertPharmacyAccess(db, actor, p.pharmacy.branchId);
  if (branchId !== p.pharmacy.branchId) throw new Error('Prescription is assigned to another branch');
  const state = integrationState(db), hash = digest({ link, cartItems });
  const existing = state.operations.find(row => row.operationId === link.operationId);
  if (existing) {
    if (existing.digest !== hash) throw new Error('Dispense operation ID reused with changed content');
    return { record, link, hash, duplicate: true };
  }
  if (record.inactive) throw new Error('Prescription or sharing grant is inactive');
  if (record.review !== 'accepted' || !record.reviewedBy) throw new Error('Pharmacist must accept and map the prescription');
  if (Date.parse(p.validUntil) <= now || Date.parse(p.consent.expiresAt) <= now) throw new Error('Prescription or sharing grant expired');
  if (!Array.isArray(link.items) || !link.items.length || link.items.length !== cartItems.length) throw new Error('Every sale item must match a prescribed item');
  const seen = new Set<string>();
  for (const item of link.items) {
    const prescribed = p.items.find(row => row.id === item.prescriptionItemId);
    const mapping = record.mappings.find(row => row.prescriptionItemId === item.prescriptionItemId);
    const carts = cartItems.filter(row => row.itemType === 'medicine' && row.itemId === item.medicineId);
    if (!prescribed || !mapping || mapping.medicineId !== item.medicineId || seen.has(item.prescriptionItemId) || carts.length !== 1 || carts[0].quantity !== item.quantity) throw new Error('Dispense does not match approved prescription mapping');
    assertMedicineMapping(db, prescribed, mapping.medicineId);
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity + (record.supplied[item.prescriptionItemId] || 0) > prescribed.quantity) throw new Error('Dispense exceeds remaining prescribed quantity');
    seen.add(item.prescriptionItemId);
  }
  return { record, link, hash, duplicate: false };
}
export function completeDispense(db: Database, prepared: ReturnType<typeof prepareDispense>, sale: Sale) {
  const { record, link, hash } = prepared, p = record.prescription;
  const state = integrationState(db);
  const items = link.items.map(item => {
    const prescribed = p.items.find(row => row.id === item.prescriptionItemId)!;
    const actual = sale.items.filter(row => row.itemType === 'medicine' && row.medicineId === item.medicineId);
    if (actual.reduce((sum,row) => sum + row.quantity, 0) !== item.quantity) throw new Error('Recorded sale does not match dispense allocation');
    record.supplied[item.prescriptionItemId] = (record.supplied[item.prescriptionItemId] || 0) + item.quantity;
    return { ...item, unit: prescribed.dispensingUnit, counsellingNote: actual[0]?.counselingNote || '', labelInstruction: actual[0]?.labelInstruction || prescribed.instructions };
  });
  record.fulfilment = p.items.every(item => record.supplied[item.id] === item.quantity) ? 'complete' : 'partial';
  state.operations.push({ operationId: link.operationId, prescriptionId: p.prescriptionId, version: p.version, digest: hash, saleId: sale.id });
  state.outbox.push({ event: makeEvent(record, 'dispense.recorded', { prescriptionId: p.prescriptionId, prescriptionVersion: p.version, patientLinkId: p.patientLinkId, sourceTransactionId: sale.id, sourceTenantId: p.pharmacy.tenantId, sourceBranchId: sale.branchId, dispensedAt: sale.soldAt, pharmacistReference: record.reviewedBy, fulfilment: record.fulfilment, items }) });
}

export function receivePrescriptionControl(db: Database, raw: unknown, scope: PartnerScope) {
  const event = raw as EcosystemEvent;
  if (!event || event.schemaVersion !== 1 || event.producer !== 'healthpass' || event.sourceOrganizationId !== scope.sourceOrganizationId || !['prescription.cancelled','consent.revoked'].includes(event.eventType)) throw new Error('Invalid prescription control');
  text(event.eventId, 'control event ID', 160); text(event.correlationId, 'control correlation',160); instant(event.occurredAt,'control time');
  if (Date.parse(event.occurredAt) > Date.now() + 300000) throw new Error('Control timestamp is in the future');
  const input = event.payload;
  if (!input || input.prescriptionId !== event.aggregateId || input.version !== event.aggregateVersion) throw new Error('Invalid control version');
  const state = integrationState(db), hash = digest(event);
  const prior = state.inbox.find(row => row.eventId === event.eventId);
  if (prior) {
    if (prior.digest !== hash) throw new Error('Control ID reused with changed content');
    return { duplicate: true, prescriptionId: event.aggregateId, version: event.aggregateVersion, status: 'acknowledged' };
  }
  const record = findPrescription(db, input.prescriptionId, input.version), p = record.prescription;
  if (record.sourceOrganizationId !== scope.sourceOrganizationId || p.pharmacy.tenantId !== scope.tenantId || p.pharmacy.branchId !== scope.branchId || p.patientLinkId !== input.patientLinkId) throw new Error('Prescription control outside partner scope');
  record.inactive = event.eventType === 'consent.revoked' ? 'consent_revoked' : 'cancelled';
  if (record.inactive === 'consent_revoked') {
    p.patient.name = ''; delete p.patient.contactPhone;
    p.items.forEach(item => { item.instructions = ''; });
    record.note = '';
  }
  state.inbox.push({ eventId: event.eventId, digest: hash });
  db.auditLogs.unshift({ id: randomUUID(), userId: 'service:healthpass', action: 'Applied HealthPass prescription control', entity: 'prescription', entityId: p.prescriptionId, createdAt: new Date().toISOString() });
  return { duplicate: false, prescriptionId: p.prescriptionId, version: p.version, status: 'acknowledged' };
}
