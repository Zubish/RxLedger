import {createHash} from 'node:crypto';
import type {Database} from '../src/types.js';
import type {PatientRecord} from '../src/patientRegistry.js';
import {normalizePatientPhone, normalizePatientName} from '../src/patientRegistry.js';

/** Conservative legacy import: branch + exact name/contact, never cross-branch merge. */
export function legacyPatientId(branch: string, name: string, phone: string) {
  if (!normalizePatientPhone(phone)) return undefined;
  return `patient_legacy_${createHash('sha256').update(JSON.stringify([branch, normalizePatientName(name), normalizePatientPhone(phone)])).digest('hex').slice(0,24)}`;
}
export function canonicalPatient(patients: PatientRecord[], id: string | undefined) {
  const visited = new Set<string>();
  let record = patients.find(item => item.id === id);
  while (record?.mergedIntoId && !visited.has(record.id)) {
    visited.add(record.id);
    record = patients.find(item => item.id === record!.mergedIntoId);
  }
  return record && !record.mergedIntoId ? record : undefined;
}

/** Pure additive projection; normal reads never write or replace historical snapshots. */
export function withPatientRegistry<T extends Database>(db: T): T {
  const patients = (db.patients || []).map(item => ({...item, normalizedPhone: normalizePatientPhone(item.phone)}));
  const byId = new Map(patients.map(patient=>[patient.id,patient]));
  const imported = new Set<string>();
  const legacyAllergies = new Map<string,Set<string>>();
  const resolve = (id: string | undefined) => {
    const visited=new Set<string>();let record=id?byId.get(id):undefined;
    while(record?.mergedIntoId && !visited.has(record.id)){visited.add(record.id);record=byId.get(record.mergedIntoId);}
    return record && !record.mergedIntoId ? record : undefined;
  };
  const link = (branchId: string, name: string, phone: string, date: string, existingId?: string, details?: PatientRecord['details']) => {
    name = name || ""; phone = phone || ""; date = date || "";
    const known = resolve(existingId);
    if (known) return known.id;
    const patientId = existingId || legacyPatientId(branchId, name, phone);
    if (!patientId) return undefined;
    let record = byId.get(patientId);
    if (!record) {
      record = {id:patientId, name:name.trim() || 'Name not recorded', phone, normalizedPhone:normalizePatientPhone(phone), details:details || {allergyStatus:'unknown',allergies:''}, createdAt:date,updatedAt:details?.updatedAt || date,needsReview:true};
      patients.push(record);byId.set(patientId,record); imported.add(patientId);
    } else if (imported.has(patientId) && details && (details.updatedAt || date) > record.updatedAt) {
      record.details=details;record.updatedAt=details.updatedAt || date;
    }
    if (imported.has(patientId) && details?.allergyStatus==='recorded' && details.allergies.trim()) {
      const allergies=legacyAllergies.get(patientId)||new Set<string>();allergies.add(details.allergies.trim());legacyAllergies.set(patientId,allergies);
    }
    return patientId;
  };
  const sales = db.sales.map(sale => ({...sale, patientId:link(sale.branchId,sale.customerName,sale.customerPhone,sale.soldAt,sale.patientId,
    sale.patientDetails || (sale.patientRiskContext?.allergies?.trim() ? {allergyStatus:'recorded',allergies:sale.patientRiskContext.allergies} : undefined))}));
  const posDrafts=db.posDrafts.map(draft=>({...draft,patientId:link(draft.branchId,draft.customerName,draft.customerPhone,draft.updatedAt,draft.patientId,draft.patientDetails)}));
  const continuityRequests=db.continuityRequests.map(request=>({...request,patientId:link(request.originBranchId,request.patientName,request.patientPhone,request.updatedAt,request.patientId)}));
  legacyAllergies.forEach((allergies,id)=>{const patient=byId.get(id)!;patient.details={...patient.details,allergyStatus:'recorded',allergies:[...allergies].join('; ')};});
  return {...db,patients,sales,posDrafts,continuityRequests};
}
