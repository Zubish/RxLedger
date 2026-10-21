import type {PatientDetails} from './patientDetails.js';

export type PatientRecord = {
  id: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  contactAliases?: string[];
  nameAliases?: string[];
  details: PatientDetails;
  createdAt: string;
  updatedAt: string;
  revision?: number;
  createdBy?: string;
  updatedBy?: string;
  sharedPhoneReason?: string;
  needsReview?: boolean;
  mergedIntoId?: string;
};
export type PatientCareVisit = {
  id: string;
  date: string;
  branchName: string;
  items: Array<{name: string; quantity: number; daysSupply?: number; instruction?: string}>;
};

/** Nigerian local numbers and their international spelling share one lookup key. */
export function normalizePatientPhone(value: string) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^0[789]\d{9}$/.test(digits)) return `234${digits.slice(1)}`;
  if (/^[789]\d{9}$/.test(digits)) return `234${digits}`;
  return digits;
}
export function normalizePatientName(value: string) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

export function patientMatchesPhone(patient: PatientRecord, phone: string) {
 const normalized=normalizePatientPhone(phone);
 return patient.normalizedPhone===normalized || Boolean(patient.contactAliases?.some(alias=>normalizePatientPhone(alias)===normalized));
}
export function patientMatchesName(patient: PatientRecord, name: string) {
 const normalized=normalizePatientName(name);
 return normalizePatientName(patient.name)===normalized || Boolean(patient.nameAliases?.some(alias=>normalizePatientName(alias)===normalized));
}
