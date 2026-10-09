/// <reference types="node" />

import { neon } from "@neondatabase/serverless";
import {
  createHash,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

type Role = "admin" | "pharmacist" | "inventory" | "cashier" | "viewer";
type UserStatus = "pending" | "active" | "suspended";
type PatientInfoReliability =
  | "confirmed_today"
  | "patient_reported"
  | "previous_record"
  | "incomplete";
type PatientAgeGroup = "child" | "adult" | "older_adult";
type PharmacistReviewOutcome =
  | "none"
  | "counselled"
  | "doctor_contacted"
  | "changed_recommendation"
  | "system_missed"
  | "dismissed";
type PatientRiskContext = {
  ageGroup?: PatientAgeGroup;
  pregnant?: boolean;
  renalRisk?: boolean;
  liverRisk?: boolean;
  allergies?: string;
  chronicMedicines?: string;
  notes?: string;
};
type LedgerType =
  | "stock-in"
  | "stock-out"
  | "adjustment"
  | "write-off"
  | "supplier-return"
  | "customer-return";
type SubscriptionPlanId = "single-branch" | "smart-pharmacy" | "enterprise";
type PricingRoundingRule = 0 | 1 | 5 | 10 | 50 | 100;

type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: UserStatus;
  branchIds: string[];
  managedBranchIds: string[];
  branchAccessExpiresAt?: Record<string, string>;
  lastChatSeenAt?: string;
  lastChatSeenAtByBranch?: Record<string, string>;
  passwordHash?: string;
  passwordSalt?: string;
  knownDevices?: Array<{
    id: string;
    label: string;
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
};

type Medicine = {
  id: string;
  sku: string;
  brandName: string;
  genericName: string;
  form: string;
  strength: string;
  unit: string;
  packSize: number;
  sellableUnit: string;
  costPrice: number;
  sellingPrice: number;
  category: string;
  manufacturer: string;
  nafdacNumber: string;
  barcodes: string[];
  reorderLevel: number;
  active: boolean;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  /** Signed movement totals for each branch, returned as a read model. */
  quantityByBranch?: Record<string, number>;
  barcodes: string[];
  supplierId: string;
  active: boolean;
  createdAt: string;
};

type Supplier = {
  id: string;
  name: string;
  contact: string;
  address: string;
  licenseRef: string;
  active: boolean;
};

type Branch = {
  id: string;
  name: string;
  code: string;
  address: string;
  managerName: string;
  managerUserId?: string;
  phone: string;
  active: boolean;
  createdAt: string;
};

type Batch = {
  id: string;
  medicineId: string;
  supplierId: string;
  batchNumber: string;
  expiryDate: string;
  unitCost: number;
  sellingPrice: number;
  receivedDate: string;
  location: string;
  branchId: string;
};

type LedgerEntry = {
  id: string;
  itemType?: "medicine" | "product";
  medicineId: string;
  productId?: string;
  batchId: string;
  batchNumber?: string;
  expiryDate?: string;
  unitCost?: number;
  sellingPrice?: number;
  location?: string;
  type: LedgerType;
  quantity: number;
  reason: string;
  reference: string;
  userId: string;
  createdAt: string;
  fromBranchId?: string;
  toBranchId?: string;
};

type StockSnapshotEntry = {
  batchId: string;
  quantity: number;
};

type LedgerSummary = {
  today: string;
  todayMovementCountsByBatchId: Record<string, number>;
  todayMovementCountsByBranchId: Record<string, number>;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  userId: string;
  channel?: "group" | "direct";
  branchId?: string;
  recipientUserId?: string;
  body: string;
  createdAt: string;
};

type PasswordResetRequest = {
  id: string;
  userId: string;
  email: string;
  status: "pending" | "completed" | "expired";
  requestedAt: string;
  expiresAt: string;
  emailSent?: boolean;
  codeHash?: string;
  resolvedAt?: string;
};

type SecurityEventType =
  | "password-reset-requested"
  | "password-reset-completed"
  | "new-device-login"
  | "panic-triggered"
  | "security-email-failed";

type SecurityEvent = {
  id: string;
  userId: string;
  email: string;
  type: SecurityEventType;
  detail: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

type RequisitionStatus =
  | "pending"
  | "released"
  | "received"
  | "fulfilled"
  | "rejected"
  | "cancelled";

type RequisitionItem = {
  id: string;
  medicineId: string;
  batchId: string;
  quantity: number;
  releasedQuantity?: number;
  fulfilledQuantity?: number;
  receivedQuantity?: number;
  destinationBatchId?: string;
};

type Requisition = {
  id: string;
  requesterUserId: string;
  requestingBranchId: string;
  sourceBranchId: string;
  status: RequisitionStatus;
  items: RequisitionItem[];
  createdAt: string;
  updatedAt: string;
  releasedBy?: string;
  releasedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  handledBy?: string;
  handledAt?: string;
  note?: string;
};

type Sale = {
  id: string;
  branchId: string;
  cashierUserId: string;
  customerName: string;
  customerPhone: string;
  patientInfoReliability?: PatientInfoReliability;
  patientRiskContext?: PatientRiskContext;
  paymentMethod: "cash" | "card" | "transfer" | "mixed";
  reference: string;
  note: string;
  followUpMessage?: string;
  pharmacistReviewOutcome?: PharmacistReviewOutcome;
  pharmacistReviewNote?: string;
  safetyReviewSummary?: string[];
  soldAt: string;
  subtotal: number;
  discount: number;
  total: number;
  bookingCode?: string;
  items: Array<{
    itemType: "medicine" | "product";
    medicineId: string;
    productId?: string;
    batchId?: string;
    itemName?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    daysSupply?: number;
    refillDueAt?: string;
    counselingNote?: string;
    followUpMessage?: string;
    labelInstruction?: string;
  }>;
};

type PosDraft = {
  id: string;
  userId: string;
  branchId: string;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  patientInfoReliability?: PatientInfoReliability;
  patientRiskContext?: PatientRiskContext;
  paymentMethod: Sale["paymentMethod"];
  discount: number;
  note: string;
  followUpMessage?: string;
  pharmacistReviewOutcome?: PharmacistReviewOutcome;
  pharmacistReviewNote?: string;
  safetyReviewSummary?: string[];
  items: Array<{
    itemType: "medicine" | "product";
    itemId: string;
    quantity: number;
    daysSupply?: number;
    counselingNote?: string;
    labelInstruction?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

type TenantRecord = {
  id: string;
  name: string;
  slug: string;
  code: string;
  businessLicense: string;
  mainBranchAddress: string;
  superAdminName: string;
  superAdminEmail: string;
  superAdminPhone: string;
  createdAt: string;
  workspace: Database;
};

type RootState = {
  tenants: TenantRecord[];
  defaultSlug: string;
};

type BranchAccessRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

type BranchAccessRequest = {
  id: string;
  userId: string;
  branchId: string;
  status: BranchAccessRequestStatus;
  requestedAt: string;
  updatedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
};

type ContinuityRequestStatus =
  | "open"
  | "matched"
  | "contacted"
  | "transferred"
  | "fulfilled"
  | "cancelled";

type ContinuityUrgency = "routine" | "important" | "urgent";

type ContinuityRequest = {
  id: string;
  patientName: string;
  patientPhone: string;
  medicineId: string;
  requestedMedicineName: string;
  quantityRequested: number;
  originBranchId: string;
  preferredBranchId?: string;
  matchedBranchId?: string;
  status: ContinuityRequestStatus;
  urgency: ContinuityUrgency;
  source: "pos" | "manual";
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  matchedAt?: string;
  contactedAt?: string;
  fulfilledAt?: string;
  closedAt?: string;
  resolvedBy?: string;
};

type MedicineLabelRule = {
  id: string;
  match: string;
  label: string;
  instruction: string;
  followUpMessage?: string;
  enabled: boolean;
};

type Database = {
  users: User[];
  medicines: Medicine[];
  products: Product[];
  suppliers: Supplier[];
  branches: Branch[];
  batches: Batch[];
  ledger: LedgerEntry[];
  stockSnapshot: StockSnapshotEntry[];
  ledgerSummary: LedgerSummary;
  receipts: Array<{
    id: string;
    supplierId: string;
    invoiceRef: string;
    receivedAt: string;
    userId: string;
    items: Array<{
      itemType?: "medicine" | "product";
      medicineId: string;
      productId?: string;
      batchId: string;
      batchNumber?: string;
      expiryDate?: string;
      sellingPrice?: number;
      location?: string;
      branchId?: string;
      quantity: number;
      unitCost: number;
    }>;
  }>;
  sales: Sale[];
  posDrafts: PosDraft[];
  chatMessages: ChatMessage[];
  passwordResetRequests: PasswordResetRequest[];
  securityEvents: SecurityEvent[];
  requisitions: Requisition[];
  branchAccessRequests: BranchAccessRequest[];
  continuityRequests: ContinuityRequest[];
  auditLogs: Array<{
    id: string;
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    createdAt: string;
  }>;
  settings: {
    softwareName: string;
    accountName: string;
    pharmacyName: string;
    branchName: string;
    companySlug: string;
    companyCode: string;
    businessLicense: string;
    mainBranchAddress: string;
    logoDataUrl: string;
    primaryAdminId?: string;
    nearExpiryDays: number;
    approvalThreshold: number;
    autoPricingEnabled?: boolean;
    globalMarkupPercent?: number;
    pricingRoundingRule?: PricingRoundingRule;
    categoryMarkupPercentages?: Record<string, number>;
    productMarkupPercentages?: Record<string, number>;
    cashierDiscountLimitPercent?: number;
    managerDiscountLimitPercent?: number;
    unusualMarkupPercent?: number;
    costChangeWarningPercent?: number;
    defaultFollowUpLabel?: string;
    defaultFollowUpMessage?: string;
    dosageFormLabelRules?: Record<string, string>;
    medicineLabelRules?: MedicineLabelRule[];
    subscriptionPlanId?: SubscriptionPlanId;
    trialStartedAt?: string;
    trialEndsAt?: string;
  };
};

type HandlerResponse = {
  status: (code: number) => HandlerResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

type HandlerRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

const SESSION_DAYS = 14;
const SESSION_IDLE_MINUTES = 30;
const SESSION_COOKIE_NAME = "rxledger_session";

const defaultDosageFormLabelRules: Record<string, string> = {
  "tablet, tablets, caplet, caplets":
    "Swallow with water unless your prescriber or pharmacist gave different directions.",
  "capsule, capsules":
    "Swallow whole with water unless your prescriber or pharmacist gave different directions.",
  "oral liquid, syrup, suspension, solution":
    "Shake well before use. Measure each dose with an oral syringe, spoon, or cup.",
  "eye drop, eyedrop, ophthalmic":
    "For eye use only. Wash hands before use and avoid touching the dropper tip.",
  "ear drop, otic":
    "For ear use only. Warm bottle in your hands before use and avoid touching the dropper tip.",
  "suppository, suppositories": "Insert as directed. Do not swallow.",
  "cream, ointment, gel, lotion":
    "Apply a thin layer to the affected area as directed. Wash hands after use unless treating the hands.",
  "inhaler, inhalation":
    "Use exactly as demonstrated. Rinse mouth after steroid inhalers unless advised otherwise.",
  "injection, injectable":
    "Use only as directed by trained staff or according to your care plan.",
};

const defaultMedicineLabelRules: MedicineLabelRule[] = [
  {
    id: "built-in-cataflam",
    match: "cataflam, diclofenac, nsaid",
    label: "Take with food",
    instruction:
      "Take with or after food. Do not combine with other painkillers unless advised.",
    followUpMessage:
      "Take Cataflam or diclofenac only as prescribed. Contact the pharmacy or your prescriber if you have stomach pain, black stool, swelling, chest pain, or breathing difficulty.",
    enabled: true,
  },
  {
    id: "built-in-metronidazole",
    match: "metronidazole, flagyl",
    label: "Avoid alcohol",
    instruction:
      "Do not take alcohol during treatment and for at least 48 hours after completing the course.",
    followUpMessage:
      "Please avoid alcohol while taking metronidazole and for at least 48 hours after completing the course. Contact the pharmacy if you feel unwell.",
    enabled: true,
  },
  {
    id: "built-in-aprovel",
    match: "aprovel, irbesartan",
    label: "Take regularly",
    instruction:
      "Take Aprovel at the same time each day. Do not stop suddenly unless your prescriber advises.",
    followUpMessage:
      "Please take Aprovel at the same time each day and keep monitoring your blood pressure as advised.",
    enabled: true,
  },
  {
    id: "built-in-natrilix",
    match: "natrilix, indapamide",
    label: "Morning dose",
    instruction:
      "Take Natrilix in the morning unless your prescriber advised a different time.",
    followUpMessage:
      "Please take Natrilix in the morning unless otherwise directed, and contact the pharmacy if you feel dizzy or unusually weak.",
    enabled: true,
  },
];

export function createEmptyDatabase(): Database {
  return {
    users: [],
    medicines: [],
    products: [],
    suppliers: [],
    branches: [
      {
        id: "main",
        name: "Main Branch",
        code: "MAIN",
        address: "",
        managerName: "",
        managerUserId: "",
        phone: "",
        active: true,
        createdAt: nowIso(),
      },
    ],
    batches: [],
    ledger: [],
    stockSnapshot: [],
    ledgerSummary: {
      today: today(),
      todayMovementCountsByBatchId: {},
      todayMovementCountsByBranchId: {},
      updatedAt: nowIso(),
    },
    receipts: [],
    sales: [],
    posDrafts: [],
    chatMessages: [],
    passwordResetRequests: [],
    securityEvents: [],
    requisitions: [],
    branchAccessRequests: [],
    continuityRequests: [],
    auditLogs: [],
    settings: {
      softwareName: "RxLedger",
      accountName: "Pharmacy Account",
      pharmacyName: "RxLedger",
      branchName: "Main Branch",
      companySlug: "",
      companyCode: "",
      businessLicense: "",
      mainBranchAddress: "",
      logoDataUrl: "",
      nearExpiryDays: 90,
      approvalThreshold: 25000,
      autoPricingEnabled: false,
      globalMarkupPercent: 30,
      pricingRoundingRule: 10,
      categoryMarkupPercentages: {},
      productMarkupPercentages: {},
      cashierDiscountLimitPercent: 5,
      managerDiscountLimitPercent: 10,
      unusualMarkupPercent: 80,
      costChangeWarningPercent: 30,
      defaultFollowUpLabel: "Follow-up",
      defaultFollowUpMessage:
        "Please contact the pharmacy if symptoms persist, your condition worsens, or you notice unusual side effects.",
      dosageFormLabelRules: defaultDosageFormLabelRules,
      medicineLabelRules: defaultMedicineLabelRules,
      subscriptionPlanId: "smart-pharmacy",
      trialStartedAt: nowIso(),
      trialEndsAt: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
  };
}

export type {
  Branch,
  BranchAccessRequest,
  BranchAccessRequestStatus,
  ChatMessage,
  ContinuityRequest,
  ContinuityRequestStatus,
  ContinuityUrgency,
  Database,
  HandlerRequest,
  HandlerResponse,
  LedgerSummary,
  LedgerType,
  Medicine,
  MedicineLabelRule,
  PasswordResetRequest,
  PosDraft,
  Product,
  Requisition,
  RequisitionItem,
  Role,
  Sale,
  SecurityEvent,
  SecurityEventType,
  StockSnapshotEntry,
  Supplier,
  TenantRecord,
  User,
};

export function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

function createMedicineBarcode(existing: Set<string>) {
  let barcode: string;
  do {
    barcode = `RXL${Math.floor(100000000000 + Math.random() * 900000000000)}`;
  } while (existing.has(barcode.toLowerCase()));
  existing.add(barcode.toLowerCase());
  return barcode;
}

export function nowIso() {
  return new Date().toISOString();
}

export function today() {
  return nowIso().slice(0, 10);
}

export function slugifyCompany(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function normalizeCompanySlug(value: string) {
  return slugifyCompany(value);
}

export function generateCompanyCode(name: string) {
  const prefix =
    slugifyCompany(name)
      .split("-")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 5) || "RXL";
  return `${prefix}-${String(Math.floor(1000 + Math.random() * 9000))}`;
}

export function getCompanySlugFromRequest(req: HandlerRequest) {
  const header = req.headers["x-rxledger-company"];
  const raw = Array.isArray(header) ? header[0] : header;
  return normalizeCompanySlug(raw || "");
}

export function daysUntil(date: string) {
  const todayDate = new Date(`${today()}T00:00:00`);
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target.getTime() - todayDate.getTime()) / 86400000);
}

export function requireMethod(
  req: HandlerRequest,
  res: HandlerResponse,
  methods: string[],
) {
  if (!req.method || !methods.includes(req.method)) {
    res.setHeader("Allow", methods.join(", "));
    res.status(405).json({ error: "Method not allowed" });
    return false;
  }
  return true;
}

export function getConnectionString() {
  const value =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL;
  if (!value)
    throw new Error(
      "Missing DATABASE_URL or POSTGRES_URL environment variable",
    );
  return value;
}

export function getSql() {
  return neon(getConnectionString());
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = ensureSchemaInternal().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function ensureSchemaInternal() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
  await sql`
    INSERT INTO app_state (id, data)
    VALUES (1, ${JSON.stringify(createEmptyDatabase())}::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS tenant_state (
      slug TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      key TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    WITH migration AS (
      INSERT INTO schema_migrations (key)
      VALUES ('tenant-state-v1')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    )
    INSERT INTO tenant_state (slug, data)
    SELECT
      lower(tenant.value->>'slug'),
      tenant.value->'workspace'
    FROM app_state state
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(state.data->'tenants') = 'array'
          THEN state.data->'tenants'
        ELSE '[]'::jsonb
      END
    ) AS tenant(value)
    WHERE state.id = 1
      AND EXISTS (SELECT 1 FROM migration)
      AND tenant.value ? 'slug'
      AND tenant.value ? 'workspace'
    ON CONFLICT (slug) DO NOTHING
  `;
}

export async function loadDatabase() {
  const root = await loadRootState();
  const tenant =
    root.tenants.find((item) => item.slug === root.defaultSlug) ||
    root.tenants[0];
  return normalizeDatabase(tenant?.workspace ?? createEmptyDatabase());
}

export async function saveDatabase(db: Database) {
  const root = await loadRootState();
  const slug = db.settings.companySlug || root.defaultSlug;
  const existing = root.tenants.find((item) => item.slug === slug);
  if (existing) {
    existing.name = db.settings.accountName;
    existing.businessLicense = db.settings.businessLicense;
    existing.mainBranchAddress = db.settings.mainBranchAddress;
    existing.workspace = normalizeDatabase(db);
  } else {
    root.tenants.unshift(
      createTenantRecord(db, slug || db.settings.accountName),
    );
    root.defaultSlug = root.tenants[0].slug;
  }
  await saveRootState(root);
}

export async function loadRootState() {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT data FROM app_state WHERE id = 1`;
  return normalizeRootState(
    rows[0].data as Partial<RootState> | Partial<Database>,
  );
}

export async function saveRootState(root: RootState) {
  const sql = getSql();
  await sql`
    UPDATE app_state
    SET data = ${JSON.stringify(normalizeRootState(root))}::jsonb,
        updated_at = now()
    WHERE id = 1
  `;
}

export async function loadTenantDatabase(slug: string) {
  const normalizedSlug = normalizeCompanySlug(slug);
  if (!normalizedSlug) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT data
    FROM tenant_state
    WHERE slug = ${normalizedSlug}
    LIMIT 1
  `;
  if (rows[0]?.data) {
    return normalizeDatabase(rows[0].data as Partial<Database>);
  }

  // Compatibility fallback for databases created before tenant_state existed.
  const root = await loadRootState();
  const tenant = root.tenants.find((item) => item.slug === normalizedSlug);
  if (!tenant) return null;
  const db = normalizeDatabase(tenant.workspace);
  await saveTenantDatabase(normalizedSlug, db);
  return db;
}

export async function loadTenantBootstrap(slug: string) {
  const normalizedSlug = normalizeCompanySlug(slug);
  if (!normalizedSlug) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      data->'settings' AS settings,
      jsonb_array_length(
        CASE
          WHEN jsonb_typeof(data->'users') = 'array' THEN data->'users'
          ELSE '[]'::jsonb
        END
      ) AS user_count
    FROM tenant_state
    WHERE slug = ${normalizedSlug}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const settings = normalizeDatabase({
    settings: rows[0].settings || {},
  } as Partial<Database>).settings;
  return {
    settings,
    hasUsers: Number(rows[0].user_count || 0) > 0,
  };
}

export async function loadTenantAuthDatabase(slug: string) {
  const normalizedSlug = normalizeCompanySlug(slug);
  if (!normalizedSlug) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      data->'settings' AS settings,
      data->'users' AS users
    FROM tenant_state
    WHERE slug = ${normalizedSlug}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return normalizeDatabase({
    settings: rows[0].settings || {},
    users: rows[0].users || [],
  } as Partial<Database>);
}

function clampHistoryLimit(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 250;
  return Math.max(25, Math.min(500, Math.floor(numeric)));
}

function parseSalesCursor(cursor = "") {
  const [soldAt = "", id = ""] = cursor.split("|");
  return { soldAt, id };
}

function makeSalesCursor(sale: Sale) {
  return `${sale.soldAt}|${sale.id}`;
}

function parseLedgerCursor(cursor = "") {
  const [createdAt = "", id = ""] = cursor.split("|");
  return { createdAt, id };
}

function makeLedgerCursor(entry: LedgerEntry) {
  return `${entry.createdAt}|${entry.id}`;
}

export async function loadTenantSalesPage(
  slug: string,
  options: { cursor?: string; limit?: number; branchIds?: string[] | null } = {},
) {
  const normalizedSlug = normalizeCompanySlug(slug);
  if (!normalizedSlug) return null;
  await ensureSchema();
  const sql = getSql();
  const safeLimit = clampHistoryLimit(options.limit);
  const queryLimit = safeLimit + 1;
  const cursor = parseSalesCursor(options.cursor);
  const rows = await sql`
    WITH sales AS (
      SELECT value AS sale
      FROM tenant_state,
        jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(data->'sales') = 'array' THEN data->'sales'
            ELSE '[]'::jsonb
          END
        ) AS value
      WHERE slug = ${normalizedSlug}
    ),
    filtered AS (
      SELECT sale
      FROM sales
      WHERE (${options.branchIds == null} OR sale->>'branchId' = ANY(${options.branchIds ?? []}::text[]))
        AND (${cursor.soldAt} = ''
         OR (sale->>'soldAt', sale->>'id') < (${cursor.soldAt}, ${cursor.id}))
      ORDER BY sale->>'soldAt' DESC, sale->>'id' DESC
      LIMIT ${queryLimit}
    )
    SELECT COALESCE(
      jsonb_agg(sale ORDER BY sale->>'soldAt' DESC, sale->>'id' DESC),
      '[]'::jsonb
    ) AS sales
    FROM filtered
  `;
  const sales = normalizeDatabase({
    sales: rows[0]?.sales || [],
  } as Partial<Database>).sales.sort((a, b) =>
    b.soldAt.localeCompare(a.soldAt) || b.id.localeCompare(a.id),
  );
  const page = sales.slice(0, safeLimit);
  return {
    sales: page,
    nextCursor: sales.length > safeLimit ? makeSalesCursor(page[page.length - 1]) : "",
  };
}

export async function loadTenantLedgerPage(
  slug: string,
  options: { cursor?: string; limit?: number; branchIds?: string[] | null } = {},
) {
  const normalizedSlug = normalizeCompanySlug(slug);
  if (!normalizedSlug) return null;
  await ensureSchema();
  const sql = getSql();
  const safeLimit = clampHistoryLimit(options.limit);
  const queryLimit = safeLimit + 1;
  const cursor = parseLedgerCursor(options.cursor);
  const rows = await sql`
    WITH ledger AS (
      SELECT value AS entry
      FROM tenant_state,
        jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(data->'ledger') = 'array' THEN data->'ledger'
            ELSE '[]'::jsonb
          END
        ) AS value
      WHERE slug = ${normalizedSlug}
    ),
    filtered AS (
      SELECT entry
      FROM ledger
      WHERE (${options.branchIds == null} OR (entry->>'itemType' = 'product' AND COALESCE(NULLIF(entry->>'toBranchId', ''), entry->>'fromBranchId') = ANY(${options.branchIds ?? []}::text[])) OR EXISTS (
        SELECT 1 FROM tenant_state AS workspace, jsonb_array_elements(workspace.data->'batches') AS batch
        WHERE workspace.slug = ${normalizedSlug} AND batch->>'id' = entry->>'batchId'
          AND batch->>'branchId' = ANY(${options.branchIds ?? []}::text[])
      )) AND (${cursor.createdAt} = ''
         OR (entry->>'createdAt', entry->>'id') < (${cursor.createdAt}, ${cursor.id}))
      ORDER BY entry->>'createdAt' DESC, entry->>'id' DESC
      LIMIT ${queryLimit}
    )
    SELECT COALESCE(
      jsonb_agg(entry ORDER BY entry->>'createdAt' DESC, entry->>'id' DESC),
      '[]'::jsonb
    ) AS ledger
    FROM filtered
  `;
  const ledger = normalizeDatabase({
    ledger: rows[0]?.ledger || [],
  } as Partial<Database>).ledger.sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
  const page = ledger.slice(0, safeLimit);
  return {
    ledger: page,
    nextCursor:
      ledger.length > safeLimit ? makeLedgerCursor(page[page.length - 1]) : "",
  };
}

export async function saveTenantDatabase(slug: string, db: Database) {
  const normalizedSlug = normalizeCompanySlug(slug);
  if (!normalizedSlug) throw new Error("Company portal not found");
  const clean = normalizeDatabase({
    ...db,
    settings: {
      ...db.settings,
      companySlug: normalizedSlug,
    },
  });
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO tenant_state (slug, data, updated_at)
    VALUES (${normalizedSlug}, ${JSON.stringify(clean)}::jsonb, now())
    ON CONFLICT (slug)
    DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
}

export async function tenantWorkspaceExists(slug: string) {
  const normalizedSlug = normalizeCompanySlug(slug);
  if (!normalizedSlug) return false;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT EXISTS(
      SELECT 1 FROM tenant_state WHERE slug = ${normalizedSlug}
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

export async function getDefaultTenantSlug() {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT COALESCE(
      (
        SELECT state.data->>'defaultSlug'
        FROM app_state state
        JOIN tenant_state tenant
          ON tenant.slug = state.data->>'defaultSlug'
        WHERE state.id = 1
        LIMIT 1
      ),
      (
        SELECT slug
        FROM tenant_state
        ORDER BY created_at ASC
        LIMIT 1
      )
    ) AS slug
  `;
  return String(rows[0]?.slug || "");
}

export async function resolveTenantSlug(value: string) {
  const lookup = value.trim().toLowerCase();
  const slug = normalizeCompanySlug(value);
  if (!lookup && !slug) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT slug
    FROM tenant_state
    WHERE slug = ${slug}
       OR lower(data #>> '{settings,companyCode}') = ${lookup}
       OR lower(data #>> '{settings,accountName}') = ${lookup}
       OR (
         ${lookup} IN ('totalenergies', 'totalenergies-pharmacy', 'tep-ng')
         AND slug = 'totalenergies-pharmacy'
       )
    LIMIT 1
  `;
  return rows[0]?.slug ? String(rows[0].slug) : null;
}

export async function resolveTenantWorkspace(value: string) {
  const slug = await resolveTenantSlug(value);
  if (!slug) return null;
  const db = await loadTenantDatabase(slug);
  if (!db) return null;
  return {
    slug,
    db,
  };
}

export function normalizeRootState(
  raw: Partial<RootState> | Partial<Database>,
): RootState {
  const candidate = raw as Partial<RootState>;
  if (Array.isArray(candidate.tenants)) {
    const tenants = candidate.tenants.map((tenant) => {
      const workspace = normalizeDatabase(
        tenant.workspace ?? createEmptyDatabase(),
      );
      const baseSlug =
        normalizeCompanySlug(
          tenant.slug ||
            workspace.settings.companySlug ||
            workspace.settings.accountName,
        ) || id("company");
      const lowerName =
        `${tenant.name || ""} ${workspace.settings.accountName || ""}`.toLowerCase();
      const slug = lowerName.includes("totalenergies")
        ? "totalenergies-pharmacy"
        : baseSlug;
      workspace.settings.companySlug = slug;
      workspace.settings.companyCode =
        tenant.code ||
        workspace.settings.companyCode ||
        generateCompanyCode(workspace.settings.accountName);
      workspace.settings.businessLicense =
        workspace.settings.businessLicense || tenant.businessLicense || "";
      workspace.settings.mainBranchAddress =
        workspace.settings.mainBranchAddress || tenant.mainBranchAddress || "";
      return {
        id: tenant.id || id("tenant"),
        name: tenant.name || workspace.settings.accountName,
        slug,
        code: workspace.settings.companyCode,
        businessLicense:
          tenant.businessLicense || workspace.settings.businessLicense,
        mainBranchAddress:
          tenant.mainBranchAddress || workspace.settings.mainBranchAddress,
        superAdminName:
          tenant.superAdminName ||
          workspace.users.find(
            (user) => user.id === workspace.settings.primaryAdminId,
          )?.name ||
          "",
        superAdminEmail:
          tenant.superAdminEmail ||
          workspace.users.find(
            (user) => user.id === workspace.settings.primaryAdminId,
          )?.email ||
          "",
        superAdminPhone:
          tenant.superAdminPhone ||
          workspace.users.find(
            (user) => user.id === workspace.settings.primaryAdminId,
          )?.phone ||
          "",
        createdAt: tenant.createdAt || nowIso(),
        workspace,
      };
    });
    return {
      tenants,
      defaultSlug: normalizeCompanySlug(
        candidate.defaultSlug || tenants[0]?.slug || "",
      ),
    };
  }
  const database = normalizeDatabase(raw as Partial<Database>);
  const tenant = createTenantRecord(
    database,
    database.settings.companySlug || database.settings.accountName,
  );
  const hasExistingWorkspace = Boolean(
    tenant.workspace.users.length ||
    tenant.workspace.medicines.length ||
    tenant.workspace.suppliers.length ||
    tenant.workspace.batches.length ||
    tenant.workspace.ledger.length ||
    tenant.workspace.sales.length ||
    (raw as Partial<Database>).settings?.primaryAdminId,
  );
  return {
    tenants: hasExistingWorkspace ? [tenant] : [],
    defaultSlug: hasExistingWorkspace ? tenant.slug : "",
  };
}

export function createTenantRecord(
  db: Database,
  slugSource: string,
): TenantRecord {
  const workspace = normalizeDatabase(db);
  const slug =
    normalizeCompanySlug(slugSource || workspace.settings.accountName) ||
    "rxledger";
  const code =
    workspace.settings.companyCode ||
    generateCompanyCode(workspace.settings.accountName);
  workspace.settings.companySlug = slug;
  workspace.settings.companyCode = code;
  const primaryAdmin = workspace.users.find(
    (user) => user.id === workspace.settings.primaryAdminId,
  );
  return {
    id: id("tenant"),
    name: workspace.settings.accountName,
    slug,
    code,
    businessLicense: workspace.settings.businessLicense || "",
    mainBranchAddress: workspace.settings.mainBranchAddress || "",
    superAdminName: primaryAdmin?.name || "",
    superAdminEmail: primaryAdmin?.email || "",
    superAdminPhone: primaryAdmin?.phone || "",
    createdAt: nowIso(),
    workspace,
  };
}

function normalizeStringMap(value: unknown, fallback: Record<string, string>) {
  if (!value || typeof value !== "object") return fallback;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(
      ([key, text]) =>
        [String(key).trim().toLowerCase(), String(text ?? "").trim()] as const,
    )
    .filter(([key, text]) => key && text);
  return entries.length ? Object.fromEntries(entries) : fallback;
}

function normalizeMedicineLabelRules(
  value: unknown,
  fallback: MedicineLabelRule[],
) {
  if (!Array.isArray(value)) return fallback;
  const rules = value.flatMap((rule, index): MedicineLabelRule[] => {
    const item = rule as Partial<MedicineLabelRule>;
    const match = String(item.match ?? "").trim();
    const label = String(item.label ?? match).trim();
    const instruction = String(item.instruction ?? "").trim();
    if (!match || !instruction) return [];
    return [
      {
        id: String(item.id ?? `rule_${index}`).trim() || `rule_${index}`,
        match,
        label: label || match,
        instruction,
        followUpMessage: String(item.followUpMessage ?? "").trim() || undefined,
        enabled: item.enabled !== false,
      },
    ];
  });
  return rules.length ? rules : fallback;
}

export function normalizeDatabase(raw: Partial<Database>): Database {
  const empty = createEmptyDatabase();
  const rawSettings = (raw.settings ?? {}) as Partial<Database["settings"]>;
  const accountName =
    rawSettings.accountName ||
    rawSettings.pharmacyName ||
    empty.settings.accountName;
  const branchName = rawSettings.branchName || empty.settings.branchName;
  const primaryAdminId =
    rawSettings.primaryAdminId ||
    raw.users?.find((user) => user.role === "admin" && user.status === "active")
      ?.id;
  const branches = (
    raw.branches?.length
      ? raw.branches
      : [
          {
            ...empty.branches[0],
            name: branchName,
            code:
              branchName
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, "-")
                .replace(/^-|-$/g, "")
                .slice(0, 12) || "MAIN",
          },
        ]
  ).map((branch) => ({
    ...empty.branches[0],
    ...branch,
    id: branch.id || id("br"),
    name: branch.name || branchName,
    code:
      branch.code ||
      branch.name
        ?.toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 12) ||
      "MAIN",
    managerUserId:
      branch.managerUserId === primaryAdminId ? "" : branch.managerUserId || "",
    managerName:
      branch.managerUserId === primaryAdminId ? "" : branch.managerName || "",
    active: branch.active !== false,
  }));
  const users = (raw.users ?? empty.users).map((user) => {
    const isPrimaryAdmin = user.id === primaryAdminId;
    const branchIds = isPrimaryAdmin
      ? []
      : user.branchIds?.length
        ? user.branchIds
        : [];
    const managedBranchIds = isPrimaryAdmin
      ? []
      : user.managedBranchIds?.length
        ? user.managedBranchIds
        : [];
    return {
      ...user,
      knownDevices: user.knownDevices ?? [],
      branchIds: Array.from(new Set(branchIds)),
      managedBranchIds: Array.from(new Set(managedBranchIds)),
      branchAccessExpiresAt: user.branchAccessExpiresAt ?? {},
    };
  });
  const existingMedicineBarcodes = new Set<string>();
  for (const product of raw.products ?? empty.products) {
    for (const barcode of product.barcodes ?? []) {
      existingMedicineBarcodes.add(String(barcode).toLowerCase());
    }
  }
  const medicines = (raw.medicines ?? empty.medicines).map((medicine) => {
    const barcodes = (medicine.barcodes ?? [])
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!barcodes.length)
      barcodes.push(createMedicineBarcode(existingMedicineBarcodes));
    barcodes.forEach((barcode) =>
      existingMedicineBarcodes.add(barcode.toLowerCase()),
    );
    return {
      ...medicine,
      packSize: Number(medicine.packSize) > 0 ? Number(medicine.packSize) : 1,
      sellableUnit: medicine.sellableUnit || medicine.unit || "Unit",
      costPrice: Number(medicine.costPrice) || 0,
      sellingPrice: Number(medicine.sellingPrice) || 0,
      barcodes,
    };
  });
  const sales = (raw.sales ?? empty.sales).map((sale) => {
    const subtotal =
      Number(sale.subtotal) ||
      sale.items?.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0) ||
      0;
    const discount = Number(sale.discount) || 0;
    return {
      ...sale,
      subtotal,
      discount,
      total: Number(sale.total) || Math.max(0, subtotal - discount),
      followUpMessage: sale.followUpMessage || undefined,
      patientInfoReliability: sale.patientInfoReliability || undefined,
      patientRiskContext: sale.patientRiskContext || undefined,
      pharmacistReviewOutcome: sale.pharmacistReviewOutcome || undefined,
      pharmacistReviewNote: sale.pharmacistReviewNote || undefined,
      safetyReviewSummary: Array.isArray(sale.safetyReviewSummary)
        ? sale.safetyReviewSummary.filter(Boolean)
        : undefined,
      items: (sale.items ?? []).map((item) => ({
        itemType: item.itemType || "medicine",
        medicineId: item.medicineId || "",
        productId: item.productId,
        batchId: item.batchId,
        itemName: item.itemName,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        lineTotal: Number(item.lineTotal) || 0,
        daysSupply: Number(item.daysSupply) || undefined,
        refillDueAt: item.refillDueAt || undefined,
        counselingNote: item.counselingNote || undefined,
        followUpMessage: item.followUpMessage || undefined,
        labelInstruction: item.labelInstruction || undefined,
      })),
    };
  });
  const normalized: Database = {
    ...empty,
    ...raw,
    users,
    medicines,
    products: (raw.products ?? empty.products).map((product) => ({
      ...product,
      costPrice: Number(product.costPrice) || 0,
      sellingPrice: Number(product.sellingPrice) || 0,
      quantity: Number(product.quantity) || 0,
      barcodes: product.barcodes ?? [],
      createdAt: product.createdAt || nowIso(),
    })),
    suppliers: raw.suppliers ?? empty.suppliers,
    branches,
    batches: raw.batches ?? empty.batches,
    ledger: (raw.ledger ?? empty.ledger).map((entry) => ({
      ...entry,
      itemType: entry.itemType === "product" ? "product" : "medicine",
      medicineId: entry.medicineId || "",
      productId: entry.productId || "",
      batchId: entry.batchId || "",
      quantity: Number(entry.quantity) || 0,
      unitCost: Number(entry.unitCost) || undefined,
      sellingPrice: Number(entry.sellingPrice) || undefined,
    })),
    receipts: (raw.receipts ?? empty.receipts).map((receipt) => ({
      ...receipt,
      items: (receipt.items ?? []).map((item) => ({
        ...item,
        itemType: item.itemType === "product" ? "product" : "medicine",
        medicineId: item.medicineId || "",
        productId: item.productId || "",
        batchId: item.batchId || "",
        branchId: item.branchId || "",
        quantity: Number(item.quantity) || 0,
        unitCost: Number(item.unitCost) || 0,
        sellingPrice: Number(item.sellingPrice) || 0,
      })),
    })),
    sales,
    posDrafts: (raw.posDrafts ?? empty.posDrafts)
      .filter((draft) => draft.expiresAt > nowIso())
      .map((draft) => ({
        ...draft,
      followUpMessage: draft.followUpMessage || undefined,
      patientInfoReliability: draft.patientInfoReliability || undefined,
      patientRiskContext: draft.patientRiskContext || undefined,
      pharmacistReviewOutcome: draft.pharmacistReviewOutcome || undefined,
      pharmacistReviewNote: draft.pharmacistReviewNote || undefined,
      safetyReviewSummary: Array.isArray(draft.safetyReviewSummary)
        ? draft.safetyReviewSummary.filter(Boolean)
        : undefined,
      items: (draft.items ?? []).map((item) => ({
          itemType: item.itemType === "product" ? "product" : "medicine",
          itemId: item.itemId || "",
          quantity: Number(item.quantity) || 0,
          daysSupply: Number(item.daysSupply) || undefined,
          counselingNote: item.counselingNote || undefined,
          labelInstruction: item.labelInstruction || undefined,
        })),
      })),
    chatMessages: (raw.chatMessages ?? empty.chatMessages).map((message) => ({
      ...message,
      channel: message.channel === "direct" ? "direct" : "group",
      recipientUserId: message.recipientUserId || "",
    })),
    passwordResetRequests: (
      raw.passwordResetRequests ?? empty.passwordResetRequests
    ).map((request) => {
      const status = String(request.status);
      return {
        ...request,
        status:
          status === "approved" || status === "rejected"
            ? "expired"
            : request.status,
        expiresAt: request.expiresAt ?? new Date(Date.now() - 1).toISOString(),
      };
    }),
    securityEvents: raw.securityEvents ?? empty.securityEvents,
    requisitions: (raw.requisitions ?? empty.requisitions).map((request) => ({
      ...request,
      items: (request.items ?? []).map((item) => ({
        ...item,
        releasedQuantity: item.releasedQuantity ?? item.fulfilledQuantity,
      })),
    })),
    branchAccessRequests:
      raw.branchAccessRequests ?? empty.branchAccessRequests,
    continuityRequests: (raw.continuityRequests ?? empty.continuityRequests).map(
      (request) => ({
        ...request,
        id: request.id || id("ctr"),
        patientName: request.patientName || "Walk-in patient",
        patientPhone: request.patientPhone || "",
        medicineId: request.medicineId || "",
        requestedMedicineName: request.requestedMedicineName || "Medicine",
        quantityRequested: Math.max(1, Number(request.quantityRequested) || 1),
        originBranchId: request.originBranchId || "main",
        preferredBranchId: request.preferredBranchId || undefined,
        matchedBranchId: request.matchedBranchId || undefined,
        status:
          request.status === "matched" ||
          request.status === "contacted" ||
          request.status === "fulfilled" ||
          request.status === "cancelled"
            ? request.status
            : "open",
        urgency:
          request.urgency === "important" || request.urgency === "urgent"
            ? request.urgency
            : "routine",
        source: request.source === "manual" ? "manual" : "pos",
        note: request.note || undefined,
        createdBy: request.createdBy || "",
        createdAt: request.createdAt || nowIso(),
        updatedAt: request.updatedAt || request.createdAt || nowIso(),
        matchedAt: request.matchedAt || undefined,
        contactedAt: request.contactedAt || undefined,
        fulfilledAt: request.fulfilledAt || undefined,
        closedAt: request.closedAt || undefined,
      }),
    ),
    auditLogs: raw.auditLogs ?? empty.auditLogs,
    settings: {
      ...empty.settings,
      ...rawSettings,
      softwareName: rawSettings.softwareName || "RxLedger",
      accountName,
      pharmacyName: rawSettings.pharmacyName || accountName,
      branchName,
      companySlug: normalizeCompanySlug(rawSettings.companySlug || accountName),
      companyCode: rawSettings.companyCode || "",
      businessLicense: rawSettings.businessLicense || "",
      mainBranchAddress: rawSettings.mainBranchAddress || "",
      logoDataUrl: rawSettings.logoDataUrl || "",
      primaryAdminId,
      defaultFollowUpLabel:
        rawSettings.defaultFollowUpLabel || empty.settings.defaultFollowUpLabel,
      defaultFollowUpMessage:
        rawSettings.defaultFollowUpMessage ||
        empty.settings.defaultFollowUpMessage,
      dosageFormLabelRules: normalizeStringMap(
        rawSettings.dosageFormLabelRules,
        defaultDosageFormLabelRules,
      ),
      medicineLabelRules: normalizeMedicineLabelRules(
        rawSettings.medicineLabelRules,
        defaultMedicineLabelRules,
      ),
      subscriptionPlanId:
        rawSettings.subscriptionPlanId === "single-branch" ||
        rawSettings.subscriptionPlanId === "enterprise"
          ? rawSettings.subscriptionPlanId
          : "smart-pharmacy",
      trialStartedAt:
        rawSettings.trialStartedAt || empty.settings.trialStartedAt,
      trialEndsAt: rawSettings.trialEndsAt || empty.settings.trialEndsAt,
    },
  };
  return withReadModels(normalized);
}

function buildStockSnapshot(db: Database): StockSnapshotEntry[] {
  const quantities = new Map<string, number>();
  db.ledger.forEach((entry) => {
    if (entry.itemType === "product" || !entry.batchId) return;
    quantities.set(
      entry.batchId,
      (quantities.get(entry.batchId) ?? 0) + entry.quantity,
    );
  });
  return db.batches.map((batch) => ({
    batchId: batch.id,
    quantity: quantities.get(batch.id) ?? 0,
  }));
}

function buildLedgerSummary(db: Database): LedgerSummary {
  const todayLabel = today();
  const todayMovementCountsByBatchId: Record<string, number> = {};
  const todayMovementCountsByBranchId: Record<string, number> = {};
  const branchByBatchId = new Map(
    db.batches.map((batch) => [batch.id, batch.branchId] as const),
  );
  db.ledger.forEach((entry) => {
    if (entry.createdAt.slice(0, 10) !== todayLabel) return;
    if (entry.itemType === "product") {
      const branchId = entry.toBranchId || entry.fromBranchId || "";
      if (branchId) {
        todayMovementCountsByBranchId[branchId] =
          (todayMovementCountsByBranchId[branchId] ?? 0) + 1;
      }
      return;
    }
    if (entry.batchId) {
      todayMovementCountsByBatchId[entry.batchId] =
        (todayMovementCountsByBatchId[entry.batchId] ?? 0) + 1;
      const branchId = branchByBatchId.get(entry.batchId);
      if (branchId) {
        todayMovementCountsByBranchId[branchId] =
          (todayMovementCountsByBranchId[branchId] ?? 0) + 1;
      }
    }
  });
  return {
    today: todayLabel,
    todayMovementCountsByBatchId,
    todayMovementCountsByBranchId,
    updatedAt: nowIso(),
  };
}

export function withReadModels(db: Database): Database {
  return {
    ...db,
    stockSnapshot: buildStockSnapshot(db),
    ledgerSummary: buildLedgerSummary(db),
  };
}

export function sanitizeDatabase(db: Database) {
  return {
    ...db,
    users: db.users.map((user) => {
      const clean = { ...user };
      delete clean.passwordHash;
      delete clean.passwordSalt;
      return clean;
    }),
    passwordResetRequests: db.passwordResetRequests.map((request) => {
      const clean = { ...request };
      delete clean.codeHash;
      return clean;
    }),
  };
}

export function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, user: User) {
  if (!user.passwordHash || !user.passwordSalt) return false;
  const attempted = hashPassword(password, user.passwordSalt).hash;
  const actualBuffer = Buffer.from(user.passwordHash, "hex");
  const attemptedBuffer = Buffer.from(attempted, "hex");
  return (
    actualBuffer.length === attemptedBuffer.length &&
    timingSafeEqual(actualBuffer, attemptedBuffer)
  );
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getRequestIp(req: HandlerRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(",")[0]?.trim() || "";
}

export function getRequestUserAgent(req: HandlerRequest) {
  const raw = req.headers["user-agent"];
  return (Array.isArray(raw) ? raw[0] : raw) || "";
}

export function getDeviceId(req: HandlerRequest) {
  const userAgent = getRequestUserAgent(req);
  const ip = getRequestIp(req);
  return hashToken(`${userAgent}|${ip}`).slice(0, 16);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 86400000,
  ).toISOString();
  const sql = getSql();
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at, last_seen_at) VALUES (${tokenHash}, ${userId}, ${expiresAt}, now())`;
  return { token, expiresAt };
}

function sessionCookieAttributes(maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

export function setSessionCookie(
  res: HandlerResponse,
  session: { token: string; expiresAt: string },
) {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
  );
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.token)}; ${sessionCookieAttributes(maxAgeSeconds)}`,
  );
}

export function clearSessionCookie(res: HandlerResponse) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; ${sessionCookieAttributes(0)}`,
  );
}

export async function deleteOtherSessions(userId: string, currentToken = "") {
  const sql = getSql();
  if (currentToken) {
    await sql`DELETE FROM sessions WHERE user_id = ${userId} AND token_hash <> ${hashToken(currentToken)}`;
    return;
  }
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
}

export async function deleteSession(token: string) {
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
}

export function getBearerToken(req: HandlerRequest) {
  const raw = req.headers.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header?.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length);
}

export function getCookieToken(req: HandlerRequest) {
  const raw = req.headers.cookie;
  const header = Array.isArray(raw) ? raw.join("; ") : raw || "";
  const cookie = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!cookie) return "";
  return decodeURIComponent(cookie.slice(SESSION_COOKIE_NAME.length + 1));
}

export function getSessionToken(req: HandlerRequest) {
  return getCookieToken(req) || getBearerToken(req);
}

export async function getAuthenticatedUser(req: HandlerRequest, db: Database) {
  const token = getSessionToken(req);
  if (!token) return null;
  const sql = getSql();
  const tokenHash = hashToken(token);
  const idleCutoff = new Date(
    Date.now() - SESSION_IDLE_MINUTES * 60_000,
  ).toISOString();
  const rows = await sql`
    SELECT user_id
    FROM sessions
    WHERE token_hash = ${tokenHash}
      AND expires_at > now()
      AND last_seen_at > ${idleCutoff}
    LIMIT 1
  `;
  const userId = rows[0]?.user_id as string | undefined;
  if (!userId) {
    await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
    return null;
  }
  await sql`UPDATE sessions SET last_seen_at = now() WHERE token_hash = ${tokenHash}`;
  return (
    db.users.find((user) => user.id === userId && user.status === "active") ??
    null
  );
}

export function addAudit(
  db: Database,
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
) {
  db.auditLogs.unshift({
    id: id("aud"),
    userId,
    action,
    entity,
    entityId,
    before,
    after,
    createdAt: nowIso(),
  });
}

export function addSecurityEvent(
  db: Database,
  event: Omit<SecurityEvent, "id" | "createdAt"> & { createdAt?: string },
) {
  db.securityEvents.unshift({
    id: id("sec"),
    createdAt: event.createdAt ?? nowIso(),
    ...event,
  });
}

export function isEmailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.APP_URL,
  );
}

export async function sendSecurityEmail(
  to: string,
  subject: string,
  text: string,
) {
  if (!isEmailConfigured())
    return { sent: false, reason: "Email is not configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || "Unable to send security email");
  }
  return { sent: true };
}

export function canWrite(user: User) {
  return (
    user.role === "admin" ||
    user.role === "pharmacist" ||
    user.role === "inventory"
  );
}

export function canAdjust(user: User) {
  return user.role === "admin" || user.role === "pharmacist";
}

export function canAdmin(user: User, primaryAdminId = "") {
  return (
    user.role === "admin" && (!primaryAdminId || user.id === primaryAdminId)
  );
}

export function getBranchAccessExpiry(user: User, branchId: string) {
  return user.branchAccessExpiresAt?.[branchId] || "";
}

export function hasActiveBranchAssignment(user: User, branchId: string) {
  const assigned =
    user.branchIds.includes(branchId) ||
    user.managedBranchIds.includes(branchId);
  if (!assigned) return false;
  const expiresAt = getBranchAccessExpiry(user, branchId);
  return !expiresAt || expiresAt >= today();
}

export function canManageBranch(
  user: User,
  branchId: string,
  primaryAdminId = "",
) {
  return (
    canAdmin(user, primaryAdminId) ||
    (user.managedBranchIds.includes(branchId) &&
      hasActiveBranchAssignment(user, branchId))
  );
}

export function canWriteBranch(
  user: User,
  branchId: string,
  primaryAdminId = "",
) {
  return (
    canAdmin(user, primaryAdminId) ||
    (canWrite(user) && hasActiveBranchAssignment(user, branchId))
  );
}

export function jsonByteLength(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export function logApiPerformance(
  req: HandlerRequest,
  route: string,
  metrics: Record<string, string | number | boolean>,
) {
  const rawRequestId = req.headers["x-vercel-id"];
  const requestId = Array.isArray(rawRequestId)
    ? rawRequestId[0] || "local"
    : rawRequestId || "local";
  console.log(
    JSON.stringify({
      level: "info",
      message: "api-performance",
      route,
      requestId,
      ...metrics,
    }),
  );
}

export function setServerTiming(
  res: HandlerResponse,
  metrics: Record<string, number>,
) {
  const value = Object.entries(metrics)
    .map(([name, duration]) => `${name};dur=${Math.max(0, Math.round(duration))}`)
    .join(", ");
  if (value) res.setHeader("Server-Timing", value);
}

export function fail(res: HandlerResponse, status: number, message: string) {
  res.status(status).json({ error: message });
}
