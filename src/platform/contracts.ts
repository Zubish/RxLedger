export const pageIds = [
  "dashboard",
  "medicines",
  "products",
  "suppliers",
  "receive",
  "pos",
  "patients",
  "continuity",
  "issue",
  "adjust",
  "reports",
  "chat",
  "notifications",
  "audit",
  "users",
  "branches",
  "settings",
] as const;
export type AccountKind = "pharmacy" | "demo" | "internal";
export type PlatformPage = "overview" | "workspaces" | "usage" | "health";
export type WorkspaceSummary = {
  slug: string;
  name: string;
  kind: AccountKind;
  createdAt: string;
  branches: number;
  activeStaff: number;
  lastActivity: string | null;
  activated: boolean;
  visits: number;
  operations: number;
};
export type UsageRow = { page: string; visits: number; workspaces: number };
export type HealthRow = {
  route: string;
  action: string;
  samples: number;
  failures: number;
  p50: number | null;
  p95: number | null;
  averageBytes: number | null;
  rejected: number;
  loadMs: number | null;
  authMs: number | null;
  saveMs: number | null;
};
export type PlatformReport = {
  generatedAt: string;
  measurementStartedAt: string;
  release: string;
  days: number;
  includeDemo: boolean;
  counts: {
    total: number;
    pharmacy: number;
    demo: number;
    internal: number;
    newPharmacies: number;
    active: number;
    activated: number;
  };
  workspacePage: {
    rows: WorkspaceSummary[];
    total: number;
    page: number;
    limit: number;
  };
  usage: UsageRow[];
  daily: { date: string; visits: number; operations: number; active: number }[];
  health: {
    routes: HealthRow[];
    samples: number;
    failures: number;
    p95: number | null;
    devices: { device: string; name: string; samples: number; p75: number }[];
    errors: {
      group: string;
      page: string;
      release: string;
      occurrences: number;
    }[];
    availability: {
      expected: number;
      observed: number;
      successes: number;
      missing: number;
      percentage: number | null;
    };
  };
};
export type OwnerStatus = {
  authenticated: boolean;
  mfaRequired?: boolean;
  mfaEnrolled?: boolean;
  user?: { name: string; email: string };
  setupAvailable?: boolean;
};
export const accountKinds = ["pharmacy", "demo", "internal"] as const;
export const actionNames = [
  "upsertMedicine",
  "upsertMedicines",
  "upsertProduct",
  "upsertSupplier",
  "upsertBranch",
  "updateBranchAccess",
  "requestBranchAccess",
  "receiveStock",
  "issueStock",
  "recordSale",
  "savePosDraft",
  "clearPosDraft",
  "adjustStock",
  "updateSellingPrice",
  "updateSettings",
  "sendChatMessage",
  "markChatRead",
  "createContinuityRequest",
  "updateContinuityRequest",
  "updatePatientProfile",
  "createRequisition",
  "fulfillRequisition",
  "receiveRequisition",
  "rejectRequisition",
  "approveUser",
  "updateUser",
  "triggerSecurityPanic",
] as const;
export const coreActions = [
  "recordSale",
  "receiveStock",
  "createContinuityRequest",
] as const;
export const deviceKinds = ["mobile", "tablet", "desktop"] as const;
