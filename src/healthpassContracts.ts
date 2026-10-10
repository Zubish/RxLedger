export type PrescriptionItem = {
  id: string; name: string; form: string; strength: string;
  dose: string | number; doseUnit: string; route: string; frequency: string; duration: string;
  quantity: number; dispensingUnit: string; instructions: string; substitutionPolicy: string;
};
export type HealthPassPrescription = {
  prescriptionId: string; version: number; patientLinkId: string;
  patient: { healthPassId: string; name: string; contactPhone?: string };
  encounterId: string;
  prescriber: { id: string; facilityId: string; verificationReference: string };
  signedAt: string; validUntil: string;
  pharmacy: { tenantId: string; branchId: string };
  consent: { grantId: string; version: number; expiresAt: string; purpose: string };
  items: PrescriptionItem[];
};
export type EcosystemEvent = {
  eventId: string; eventType: string; schemaVersion: number; occurredAt: string;
  producer: string; sourceOrganizationId: string; correlationId: string;
  aggregateId: string; aggregateVersion: number; payload: Record<string, unknown>;
};
export type PharmacyPrescription = {
  prescription: HealthPassPrescription; sourceOrganizationId: string; correlationId: string;
  receivedAt: string; review: 'pending' | 'accepted' | 'clarification_required' | 'rejected';
  mappings: { prescriptionItemId: string; medicineId: string }[];
  reviewedBy?: string; reviewedAt?: string; note?: string;
  inactive?: 'cancelled' | 'consent_revoked';
  supplied: Record<string, number>; fulfilment: 'none' | 'partial' | 'complete';
};
export type HealthPassState = {
  prescriptions: PharmacyPrescription[];
  inbox: { eventId: string; digest: string }[];
  operations: { operationId: string; prescriptionId: string; version: number; digest: string; saleId: string }[];
  outbox: { event: EcosystemEvent; acknowledgedAt?: string }[];
};
