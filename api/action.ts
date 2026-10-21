import type {PatientRecord} from "../src/patientRegistry.js";
import {canonicalPatient} from "../server/patient-registry.js";
import {normalizePatientPhone as canonicalPhone, normalizePatientName, patientMatchesPhone, patientMatchesName} from "../src/patientRegistry.js";
import { createHash } from "node:crypto";
import type {PatientDetails} from "../src/patientDetails.js";
import { inventoryAlerts } from "../src/alertPolicy.js";
import { accessibleBranchIds, canAccessPatientRegistry, productQuantityInBranches, scopeDatabaseForUser } from "../server/branch-scope.js";
import {
  addAudit,
  addSecurityEvent,
  canAdjust,
  canAdmin,
  canManageBranch,
  canWrite,
  canWriteBranch,
  daysUntil,
  deleteOtherSessions,
  fail,
  getAuthenticatedUser,
  getCompanySlugFromRequest,
  getRequestIp,
  getRequestUserAgent,
  hasActiveBranchAssignment,
  id,
  jsonByteLength,
  loadTenantDatabase,
  logApiPerformance,
  trackApi,
  nowIso,
  requireMethod,
  sanitizeDatabase,
  saveTenantDatabase,
  sendSecurityEmail,
  setServerTiming,
  today,
  withReadModels,
} from "../server/_shared.js";
import type {
  Database,
  HandlerRequest,
  HandlerResponse,
  LedgerType,
  Medicine,
  PosDraft,
  Product,
  Role,
  Sale,
  Supplier,
  User,
} from "../server/_shared.js";
import {
  buildDatabasePatch,
  snapshotHeavyCollections,
  stripHeavyCollections,
} from "../src/databasePatch.js";
import type { Branch } from "../server/_shared.js";

type CheckoutResult = {state: "confirmed" | "cancelled" | "not_found"; sale?: Sale; replayed?: boolean};

type ActionBody = {
  action: string;
  payload?: Record<string, unknown>;
};

type SubscriptionPlanId = NonNullable<
  Database["settings"]["subscriptionPlanId"]
>;
type PricingRoundingRule = NonNullable<
  Database["settings"]["pricingRoundingRule"]
>;

export default async function handler(
  req: HandlerRequest,
  res: HandlerResponse,
) {
  trackApi(req, res, "/api/action");
  if (!requireMethod(req, res, ["POST"])) return;
  const startedAt = Date.now();
  let actionName = "unknown";
  let loadMs = 0;
  let authMs = 0;
  let saveMs = 0;
  let saveAttempted = false;
  try {
    const body = req.body as ActionBody;
    actionName = body.action || "unknown";
    const companySlug = getCompanySlugFromRequest(req);
    if (!companySlug) {
      fail(res, 400, "Choose a company portal before making changes");
      return;
    }
    const loadStartedAt = Date.now();
    const db = await loadTenantDatabase(companySlug);
    loadMs = Date.now() - loadStartedAt;
    if (!db) {
      fail(res, 404, "Company portal not found");
      return;
    }
    const authStartedAt = Date.now();
    const actor = await getAuthenticatedUser(req, db);
    authMs = Date.now() - authStartedAt;
    if (!actor) {
      fail(res, 401, "Authentication required");
      return;
    }
    let responseActor = actor;
    const heavySnapshot = snapshotHeavyCollections(scopeDatabaseForUser(db, actor));

    let patientResult: PatientRecord | undefined;
    let patientCareHistory: Array<{id:string;date:string;branchName:string;items:Array<{name:string;quantity:number;daysSupply?:number;instruction?:string}>}> | undefined;
    let checkoutResult: CheckoutResult | undefined;
    let skipSave = false;
    switch (body.action) {
      case "setAlertPreferences": {
        const payload = body.payload || {};
        const mode = payload.mode;
        if (mode !== "snoozed" && mode !== "muted" && mode !== "restore")
          throw new Error("Choose a valid alert action");
        if (
          !Array.isArray(payload.alerts) ||
          !payload.alerts.length ||
          payload.alerts.length > 1000
        )
          throw new Error("Choose between 1 and 1000 alerts");
        const scoped = scopeDatabaseForUser(db, actor);
        const inventoryKeys = new Map(
          inventoryAlerts(scoped).map((item) => [item.id, item.branchId]),
        );
        const allowed = accessibleBranchIds(
          actor,
          db.settings.primaryAdminId ||
            db.users.find(
              (item) => item.role === "admin" && item.status === "active",
            )?.id ||
            "",
        );
        const targets = payload.alerts.map((raw) => {
          const input = raw as { key?: unknown; branchId?: unknown };
          if (typeof input.key !== "string" || input.key.length > 300 || !input.key)
            throw new Error("Invalid alert identity");
          const branchId =
            typeof input.branchId === "string" ? input.branchId : undefined;
          if (branchId && allowed !== null && !allowed.includes(branchId))
            throw new Error("Alert branch is outside your access");
          if (
            /^(low|out|near|expired):/.test(input.key) &&
            !inventoryKeys.has(input.key)
          )
            throw new Error("This stock alert is no longer active or permitted");
          if (
            !/^(low|out|near|expired):/.test(input.key) &&
            !/^(chat-unread|pending-|incoming-requisition-|released-requisition-|branch-access-|continuity-matched|receipt-|received-|handled-requisition-)/.test(
              input.key,
            )
          )
            throw new Error("Invalid alert type");
          if (input.key.startsWith("pending-") && allowed !== null)
            throw new Error("Staff approvals require global access");
          return {
            key: input.key,
            branchId: inventoryKeys.get(input.key) || branchId,
          };
        });
        const keys = new Set(targets.map((item) => item.key));
        const preferences = (db.alertPreferences || []).filter(
          (item) => item.userId !== actor.id || !keys.has(item.key),
        );
        if (mode !== "restore")
          preferences.push(
            ...targets.map((item) => ({
              ...item,
              userId: actor.id,
              mode: mode as "snoozed" | "muted",
              clearedAt: nowIso(),
            })),
          );
        db.alertPreferences = preferences;
        addAudit(
          db,
          actor.id,
          "Alert preferences updated",
          "alerts",
          actor.id,
          undefined,
          { mode, count: targets.length },
        );
        break;
      }
      case "updateUser":
        updateUser(db, actor.id, body.payload);
        break;
      case "triggerSecurityPanic":
        await triggerSecurityPanic(req, db, actor.id);
        break;
      case "upsertMedicine":
        upsertMedicine(db, actor.id, actor.role, body.payload);
        break;
      case "upsertMedicines":
        upsertMedicines(db, actor.id, actor.role, body.payload);
        break;
      case "upsertProduct":
        upsertProduct(db, actor.id, actor.role, body.payload);
        break;
      case "upsertSupplier":
        upsertSupplier(db, actor.id, actor.role, body.payload);
        break;
      case "upsertBranch":
        upsertBranch(db, actor.id, actor.role, body.payload);
        break;
      case "updateBranchAccess":
        updateBranchAccess(db, actor.id, body.payload);
        break;
      case "requestBranchAccess":
        requestBranchAccess(db, actor.id, body.payload);
        break;
      case "receiveStock":
        receiveStock(db, actor.id, actor.role, body.payload);
        break;
      case "createContinuityRequest":
        createContinuityRequest(db, actor.id, actor.role, body.payload);
        break;
      case "updateContinuityRequest":
        updateContinuityRequest(db, actor.id, actor.role, body.payload);
        break;
      case "refreshPatientRegistry":
        patientRegistryActor(db,actor.id,requireString(body.payload?.branchId,"Branch"));
        skipSave = true;
        break;
      case "getRegistryPatient":
        patientRegistryActor(db,actor.id,requireString(body.payload?.branchId,"Branch"));
        patientResult = canonicalPatient(db.patients || [],requireString(body.payload?.patientId,"Patient"));
        if (!patientResult) throw new Error("Patient not found in this workspace");
        skipSave = true;
        break;
      case "createPatient":
        patientResult = createRegistryPatient(db, actor.id, body.payload);
        break;
      case "updateRegistryPatient":
        patientResult = updateRegistryPatient(db, actor.id, body.payload);
        break;
      case "mergeRegistryPatients":
        patientResult = mergeRegistryPatients(db, actor.id, body.payload);
        break;
      case "getPatientCareHistory":
        patientCareHistory = patientCareHistoryForUser(db, actor.id, body.payload);
        break;
      case "updatePatientProfile":
        updatePatientProfile(db, actor.id, body.payload);
        break;
      case "createRequisition":
        createRequisition(db, actor.id, body.payload);
        break;
      case "fulfillRequisition":
        fulfillRequisition(db, actor.id, body.payload);
        break;
      case "receiveRequisition":
        receiveRequisition(db, actor.id, body.payload);
        break;
      case "rejectRequisition":
        rejectRequisition(db, actor.id, body.payload);
        break;
      case "issueStock":
        issueStock(db, actor.id, actor.role, body.payload);
        break;
      case "recordSale":
        checkoutResult = recordSale(db, actor.id, actor.role, body.payload);
        skipSave = Boolean(checkoutResult.replayed);
        break;
      case "getCheckoutStatus":
        checkoutResult = checkoutStatus(db, actor.id, actor.role, body.payload);
        skipSave = true;
        break;
      case "cancelCheckout":
        checkoutResult = cancelCheckout(db, actor.id, actor.role, body.payload);
        skipSave = checkoutResult.state === "confirmed" || Boolean(checkoutResult.replayed);
        break;
      case "savePosDraft":
        savePosDraft(db, actor.id, actor.role, body.payload);
        break;
      case "clearPosDraft":
        clearPosDraft(db, actor.id, body.payload);
        break;
      case "adjustStock":
        adjustStock(db, actor.id, actor.role, body.payload);
        break;
      case "updateSellingPrice":
        updateSellingPrice(db, actor.id, actor.role, body.payload);
        break;
      case "updateSettings":
        updateSettings(db, actor.id, actor.role, body.payload);
        break;
      case "sendChatMessage":
        sendChatMessage(db, actor.id, body.payload);
        break;
      case "markChatRead":
        markChatRead(db, actor.id, body.payload);
        break;
      default:
        fail(res, 400, "Unknown action");
        return;
    }

    const saveStartedAt = Date.now();
    let dbWithReadModels = withReadModels(db);
    if (!skipSave) {
      saveAttempted = true;
      try {
        await saveTenantDatabase(companySlug, dbWithReadModels);
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "WorkspaceConflictError" ||
            !["recordSale", "cancelCheckout"].includes(body.action)) throw error;
        // Another request may have committed this operation. Re-authorise on
        // fresh state and return its receipt, never replay old mutated state.
        const fresh = await loadTenantDatabase(companySlug);
        const freshActor = fresh && await getAuthenticatedUser(req, fresh);
        if (!fresh || !freshActor) throw new Error("Authentication required", {cause: error});
        const recovered = body.action === "recordSale"
          ? completedCheckout(fresh, freshActor.id, freshActor.role, body.payload)
          : checkoutStatus(fresh, freshActor.id, freshActor.role, body.payload);
        if (!recovered || recovered.state === "not_found") throw error;
        if (body.action === "recordSale" && recovered.state === "cancelled")
          throw new Error("This checkout was cancelled. Start a new sale.", {cause: error});
        responseActor = freshActor; checkoutResult = recovered;
        dbWithReadModels = withReadModels(fresh);
      }
    }
    saveMs = Date.now() - saveStartedAt;
    const clean = scopeDatabaseForUser(sanitizeDatabase(dbWithReadModels), responseActor);
    const databasePatch = buildDatabasePatch(heavySnapshot, clean);
    if (checkoutResult?.sale) {
      const sale = checkoutResult.sale;
      if (!databasePatch.sales.upserts.some(item => item.id === sale.id)) databasePatch.sales.upserts.push(sale);
      for (const entry of clean.ledger.filter(item => item.reference === sale.reference)) {
        if (!databasePatch.ledger.upserts.some(item => item.id === entry.id)) databasePatch.ledger.upserts.push(entry);
      }
    }
    const response = {
      checkout: checkoutResult,
      patient: patientResult,
      patientCareHistory,
      db: stripHeavyCollections(clean),
      databasePatch,
      currentUser: clean.users.find((user) => user.id === responseActor.id),
    };
    const totalMs = Date.now() - startedAt;
    const responseBytes = jsonByteLength(response);
    setServerTiming(res, {
      load: loadMs,
      auth: authMs,
      save: saveMs,
      total: totalMs,
    });
    logApiPerformance(req, "/api/action", {
      ok: true,
      action: actionName,
      status: 200,
      operationId: companySlug + ":" + actionName + ":" + (db.auditLogs[0]?.id || ""),
      loadMs,
      authMs,
      saveMs,
      totalMs,
      responseBytes,
    });
    res.status(200).json(response);
  } catch (error) {
    logApiPerformance(req, "/api/action", {
      ok: false,
      status: 400,
      action: actionName,
      loadMs,
      authMs,
      saveMs,
      totalMs: Date.now() - startedAt,
    });
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unable to complete action",
      checkoutState: saveAttempted || (error instanceof Error && error.name === "CheckoutMismatchError") ? "unknown" : "rejected",
    });
  }
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} is required`);
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePatientPhone(value: string) {
  return canonicalPhone(value);
}

function normalizePatientRiskContext(
  value: unknown,
): NonNullable<Sale["patientRiskContext"]> {
  const input = (value ?? {}) as Record<string, unknown>;
  const ageGroup: NonNullable<Sale["patientRiskContext"]>["ageGroup"] =
    input.ageGroup === "child" ||
    input.ageGroup === "older_adult" ||
    input.ageGroup === "adult"
      ? input.ageGroup
      : undefined;
  return {
    ageGroup,
    pregnant: Boolean(input.pregnant),
    renalRisk: Boolean(input.renalRisk),
    liverRisk: Boolean(input.liverRisk),
    allergies: optionalString(input.allergies) || undefined,
    chronicMedicines: optionalString(input.chronicMedicines) || undefined,
    notes: optionalString(input.notes) || undefined,
  };
}

function normalizePatientInfoReliability(value: unknown) {
  return value === "confirmed_today" ||
    value === "previous_record" ||
    value === "incomplete"
    ? value
    : "patient_reported";
}

function normalizePharmacistReviewOutcome(value: unknown) {
  return value === "counselled" ||
    value === "doctor_contacted" ||
    value === "changed_recommendation" ||
    value === "system_missed" ||
    value === "dismissed"
    ? value
    : "none";
}

function normalizeSafetyReviewSummary(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => optionalString(item)).filter(Boolean).slice(0, 8)
    : [];
}

function normalizeSubscriptionPlanId(
  value: unknown,
  fallback: SubscriptionPlanId,
): SubscriptionPlanId {
  return value === "single-branch" ||
    value === "smart-pharmacy" ||
    value === "enterprise"
    ? value
    : fallback;
}

function subscriptionPlanBlockers(
  db: Database,
  targetPlanId: SubscriptionPlanId,
) {
  if (targetPlanId === "enterprise") return [];
  const activeBranches = db.branches.filter((branch) => branch.active).length;
  const activeStaff = db.users.filter(
    (user) => user.status === "active",
  ).length;
  const branchLimit = targetPlanId === "single-branch" ? 1 : 5;
  const staffLimit = targetPlanId === "single-branch" ? 5 : 25;
  const planName =
    targetPlanId === "single-branch" ? "Single Branch" : "Smart Pharmacy";
  const blockers: string[] = [];
  if (activeBranches > branchLimit)
    blockers.push(
      `${planName} allows ${branchLimit} active branch${branchLimit === 1 ? "" : "es"}.`,
    );
  if (activeStaff > staffLimit)
    blockers.push(`${planName} allows up to ${staffLimit} active staff.`);
  return blockers;
}

function requireNumber(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error(`${label} must be a valid number`);
  return parsed;
}

function normalizeMarkupMap(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, amount]) => [
        key.trim().toLowerCase(),
        Math.max(0, Number(amount) || 0),
      ])
      .filter(([key]) => key),
  );
}

function normalizeStringMap(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, text]) => [
        key.trim().toLowerCase(),
        String(text ?? "").trim(),
      ])
      .filter(([key, text]) => key && text),
  );
}

function normalizeMedicineLabelRules(
  value: unknown,
): NonNullable<Database["settings"]["medicineLabelRules"]> {
  if (!Array.isArray(value)) return [];
  return value.flatMap(
    (rule, index): NonNullable<Database["settings"]["medicineLabelRules"]> => {
      const item = rule as Partial<
        NonNullable<Database["settings"]["medicineLabelRules"]>[number]
      >;
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
          followUpMessage:
            String(item.followUpMessage ?? "").trim() || undefined,
          enabled: item.enabled !== false,
        },
      ];
    },
  );
}

function pricingPolicy(settings: Database["settings"]) {
  const configuredRounding = Number(settings.pricingRoundingRule ?? 10);
  const roundingRule = Number.isFinite(configuredRounding) && configuredRounding >= 0
    ? configuredRounding : 10;
  return {
    enabled: Boolean(settings.autoPricingEnabled),
    globalMarkupPercent: Math.max(0, Number(settings.globalMarkupPercent) || 0),
    roundingRule,
    categoryMarkupPercentages: normalizeMarkupMap(
      settings.categoryMarkupPercentages,
    ),
    productMarkupPercentages: normalizeMarkupMap(
      settings.productMarkupPercentages,
    ),
    cashierDiscountLimitPercent: Math.max(
      0,
      Number(settings.cashierDiscountLimitPercent ?? 5) || 0,
    ),
    managerDiscountLimitPercent: Math.max(
      0,
      Number(settings.managerDiscountLimitPercent ?? 10) || 0,
    ),
  };
}

function roundSellingPrice(value: number, rule: PricingRoundingRule) {
  const price = Math.max(0, Number(value) || 0);
  if (!rule) return Math.round(price * 100) / 100;
  return Math.round((Math.round(price / rule) * rule) * 100) / 100;
}

function productSpecificKeys(
  itemType: "medicine" | "product",
  item: Medicine | Product,
) {
  if (itemType === "medicine") {
    const medicine = item as Medicine;
    return [
      `${itemType}:${medicine.id}`,
      medicine.id,
      medicine.sku,
      medicine.brandName,
      medicine.genericName,
      medicine.nafdacNumber,
    ]
      .map((key) => key.trim().toLowerCase())
      .filter(Boolean);
  }
  const product = item as Product;
  return [`${itemType}:${product.id}`, product.id, product.sku, product.name]
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean);
}

function markupForItem(
  db: Database,
  itemType: "medicine" | "product",
  itemId: string,
) {
  const policy = pricingPolicy(db.settings);
  const item =
    itemType === "medicine"
      ? db.medicines.find((medicine) => medicine.id === itemId)
      : db.products.find((product) => product.id === itemId);
  if (!item) return policy.globalMarkupPercent;
  for (const key of productSpecificKeys(itemType, item)) {
    const value = policy.productMarkupPercentages[key];
    if (value !== undefined) return value;
  }
  const category = item.category.trim().toLowerCase();
  if (category && policy.categoryMarkupPercentages[category] !== undefined)
    return policy.categoryMarkupPercentages[category];
  return policy.globalMarkupPercent;
}

function calculatedSellingPrice(
  db: Database,
  itemType: "medicine" | "product",
  itemId: string,
  unitCost: number,
) {
  const policy = pricingPolicy(db.settings);
  const markupPercent = markupForItem(db, itemType, itemId);
  return Math.max(Math.round(Math.max(0, unitCost) * 100) / 100, roundSellingPrice(
    Math.max(0, unitCost) * (1 + markupPercent / 100),
    policy.roundingRule,
  ));
}

function discountLimitPercent(db: Database, actor: User) {
  if (canAdmin(actor, getPrimaryAdminId(db)) || actor.role === "admin")
    return 100;
  const policy = pricingPolicy(db.settings);
  if (
    db.branches.some((branch) =>
      canManageBranch(actor, branch.id, getPrimaryAdminId(db)),
    )
  )
    return policy.managerDiscountLimitPercent;
  if (actor.role === "pharmacist" || actor.role === "inventory")
    return policy.managerDiscountLimitPercent;
  if (actor.role === "cashier") return policy.cashierDiscountLimitPercent;
  return 0;
}

function getPrimaryAdminId(db: Database) {
  return (
    db.settings.primaryAdminId ||
    db.users.find((user) => user.role === "admin" && user.status === "active")
      ?.id ||
    ""
  );
}

function updateUser(
  db: Database,
  actorId: string,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  const primaryAdminId = getPrimaryAdminId(db);
  if (!actor || !canAdmin(actor, primaryAdminId))
    throw new Error("Only the permanent admin can update users");
  const userId = requireString(payload?.userId, "User");
  const target = db.users.find((user) => user.id === userId);
  if (!target) throw new Error("User not found");
  const updates = (payload?.updates ?? {}) as Partial<{
    role: Role;
    status: "pending" | "active" | "suspended";
  }>;
  if (
    target.id === primaryAdminId &&
    ((updates.status && updates.status !== "active") ||
      (updates.role && updates.role !== "admin"))
  ) {
    throw new Error(
      "The permanent account admin cannot be downgraded or suspended",
    );
  }
  if (target.id === actorId && updates.status && updates.status !== "active")
    throw new Error("You cannot suspend your own active admin account");
  const before = { ...target };
  if (updates.role) target.role = updates.role;
  if (updates.status) {
    target.status = updates.status;
    if (updates.status === "active") {
      target.approvedAt = nowIso();
      target.approvedBy = actorId;
      if (!target.branchIds.length && db.branches[0])
        target.branchIds = [db.branches[0].id];
    }
  }
  addAudit(db, actorId, "Updated user access", "user", userId, before, {
    ...target,
  });
}

async function triggerSecurityPanic(
  req: HandlerRequest,
  db: Database,
  actorId: string,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  await deleteOtherSessions(actorId);
  actor.knownDevices = [];
  addSecurityEvent(db, {
    userId: actor.id,
    email: actor.email,
    type: "panic-triggered",
    severity: "critical",
    detail:
      "The user triggered Secure my account. All sessions were signed out and remembered browsers were cleared.",
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
  });
  addAudit(
    db,
    actorId,
    "Triggered secure account panic action",
    "user",
    actorId,
    undefined,
    { signedOutAllSessions: true, clearedRememberedBrowsers: true },
  );
  try {
    await sendSecurityEmail(
      actor.email,
      "RxLedger account security action triggered",
      "Secure my account was triggered for your RxLedger account. All sessions were signed out and remembered browsers were cleared. If this was not you, reset your password immediately.",
    );
  } catch (error) {
    addSecurityEvent(db, {
      userId: actor.id,
      email: actor.email,
      type: "security-email-failed",
      severity: "warning",
      detail:
        error instanceof Error
          ? error.message
          : "Unable to send panic alert email.",
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
    });
  }
}

function updateBranchAccess(
  db: Database,
  actorId: string,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  const branchId = requireString(payload?.branchId, "Branch");
  const primaryAdminId = getPrimaryAdminId(db);
  if (!actor || !canManageBranch(actor, branchId, primaryAdminId))
    throw new Error(
      "Only this branch manager or the permanent admin can update branch access",
    );
  const branch = db.branches.find((item) => item.id === branchId);
  if (!branch) throw new Error("Branch not found");
  const userId = requireString(payload?.userId, "User");
  const target = db.users.find((user) => user.id === userId);
  if (!target) throw new Error("User not found");
  if (target.status !== "active")
    throw new Error("Only active users can be assigned to branches");
  if (target.id === primaryAdminId)
    throw new Error("The permanent admin already has access to every branch");
  const canAccess = Boolean(payload?.canAccess);
  const expiresAt = optionalString(payload?.expiresAt);
  if (canAccess && expiresAt && expiresAt < today())
    throw new Error("Branch access expiry must be today or a future date");
  if (!canAccess && target.managedBranchIds.includes(branchId))
    throw new Error(
      "Branch managers cannot be removed from their managed branch here",
    );
  const otherManagedBranchIds = target.managedBranchIds.filter(
    (id) => id !== branchId && hasActiveBranchAssignment(target, id),
  );
  if (canAccess && otherManagedBranchIds.length) {
    throw new Error(
      "This user manages another branch. Change their manager assignment before moving them.",
    );
  }
  const otherBranchIds = target.branchIds.filter(
    (id) => id !== branchId && hasActiveBranchAssignment(target, id),
  );
  if (canAccess && otherBranchIds.length && !canAdmin(actor, primaryAdminId)) {
    const currentBranch = db.branches.find(
      (item) => item.id === otherBranchIds[0],
    );
    throw new Error(
      `${target.name} is still assigned to ${currentBranch?.name ?? "another branch"}. That branch manager must release them before they can work here.`,
    );
  }
  const before = {
    ...target,
    branchIds: [...target.branchIds],
    managedBranchIds: [...target.managedBranchIds],
    branchAccessExpiresAt: { ...(target.branchAccessExpiresAt ?? {}) },
  };
  target.branchAccessExpiresAt = { ...(target.branchAccessExpiresAt ?? {}) };
  target.branchIds = canAccess
    ? [branchId]
    : target.branchIds.filter((id) => id !== branchId);
  if (canAccess && expiresAt) {
    target.branchAccessExpiresAt[branchId] = expiresAt;
  } else {
    delete target.branchAccessExpiresAt[branchId];
  }
  if (canAccess) {
    db.branchAccessRequests = db.branchAccessRequests.map((request) =>
      request.userId === userId &&
      request.branchId === branchId &&
      request.status === "pending"
        ? {
            ...request,
            status: "approved",
            updatedAt: nowIso(),
            resolvedAt: nowIso(),
            resolvedBy: actorId,
          }
        : request,
    );
  }
  addAudit(
    db,
    actorId,
    canAccess ? "Granted branch access" : "Removed branch access",
    "user",
    userId,
    before,
    { ...target },
  );
}

function requestBranchAccess(
  db: Database,
  actorId: string,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  if (actor.status !== "active")
    throw new Error("Only active users can request branch access");
  if (actor.id === getPrimaryAdminId(db))
    throw new Error("The permanent admin already has access to every branch");
  const branchId = requireString(payload?.branchId, "Branch");
  if (!db.branches.some((branch) => branch.id === branchId && branch.active))
    throw new Error("Active branch not found");
  if (hasActiveBranchAssignment(actor, branchId))
    throw new Error("You already have access to this branch");
  const existing = db.branchAccessRequests.find(
    (request) =>
      request.userId === actorId &&
      request.branchId === branchId &&
      request.status === "pending",
  );
  if (existing) return;
  const request = {
    id: id("bar"),
    userId: actorId,
    branchId,
    status: "pending" as const,
    requestedAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.branchAccessRequests.unshift(request);
  addAudit(
    db,
    actorId,
    "Requested branch access",
    "branch-access-request",
    request.id,
    undefined,
    request,
  );
}

function barcodeExists(db: Database, barcode: string, ownerId = "") {
  const needle = barcode.toLowerCase();
  return (
    db.medicines.some(
      (medicine) =>
        medicine.id !== ownerId &&
        medicine.barcodes.some((code) => code.toLowerCase() === needle),
    ) ||
    db.products.some((product) =>
      product.barcodes.some((code) => code.toLowerCase() === needle),
    )
  );
}

function generateMedicineBarcode(db: Database, ownerId: string) {
  let barcode: string;
  do {
    barcode = `RXL${Math.floor(100000000000 + Math.random() * 900000000000)}`;
  } while (barcodeExists(db, barcode, ownerId));
  return barcode;
}

function canManageMedicinePrices(
  db: Database,
  actor: User,
  actorRole: Role,
  branchId?: string,
) {
  const primaryAdminId = getPrimaryAdminId(db);
  if (canAdmin(actor, primaryAdminId)) return true;
  if (branchId && canManageBranch(actor, branchId, primaryAdminId)) return true;
  return actorRole === "inventory" && branchId
    ? hasActiveBranchAssignment(actor, branchId)
    : false;
}

function upsertMedicine(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor || !canWrite({ ...actor, role: actorRole }))
    throw new Error("You do not have permission to save medicines");
  const record = normalizeMedicine(
    (payload?.record ?? {}) as Partial<Medicine>,
  );
  const branchId = optionalString(payload?.branchId);
  saveMedicineRecord(db, actorId, actor, actorRole, branchId, record);
}

function upsertMedicines(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor || !canWrite({ ...actor, role: actorRole }))
    throw new Error("You do not have permission to save medicines");
  const inputs = Array.isArray(payload?.records)
    ? (payload.records as Partial<Medicine>[])
    : [];
  if (!inputs.length) throw new Error("Add at least one medicine record");
  const records = inputs.map((record) => normalizeMedicine(record));
  const seenBarcodes = new Map<string, string>();
  for (const record of records) {
    for (const barcode of record.barcodes) {
      const normalizedBarcode = barcode.toLowerCase();
      const previous = seenBarcodes.get(normalizedBarcode);
      if (previous && previous !== record.id)
        throw new Error(
          `Barcode ${barcode} appears more than once in this import`,
        );
      seenBarcodes.set(normalizedBarcode, record.id);
    }
  }
  const branchId = optionalString(payload?.branchId);
  records.forEach((record) =>
    saveMedicineRecord(db, actorId, actor, actorRole, branchId, record),
  );
  addAudit(
    db,
    actorId,
    `Bulk saved ${records.length} medicine records`,
    "medicine",
    "bulk",
    undefined,
    records.map((record) => record.id),
  );
}

function normalizeMedicine(recordInput: Partial<Medicine>): Medicine {
  const barcodes = Array.isArray(recordInput.barcodes)
    ? recordInput.barcodes
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const costPrice = Number(recordInput.costPrice) || 0;
  const sellingPrice = Number(recordInput.sellingPrice) || 0;
  if (sellingPrice > 0 && sellingPrice < costPrice)
    throw new Error(
      "Selling price must be equal to or greater than cost price",
    );
  return {
    id: recordInput.id || id("med"),
    sku: requireString(recordInput.sku, "SKU"),
    brandName: requireString(recordInput.brandName, "Brand name"),
    genericName: requireString(recordInput.genericName, "Generic name"),
    form: optionalString(recordInput.form) || "Tablet",
    strength: optionalString(recordInput.strength),
    unit: optionalString(recordInput.unit) || "Pack",
    packSize: Math.max(1, Number(recordInput.packSize) || 1),
    sellableUnit:
      optionalString(recordInput.sellableUnit) ||
      optionalString(recordInput.unit) ||
      "Unit",
    costPrice,
    sellingPrice,
    category: optionalString(recordInput.category),
    manufacturer: optionalString(recordInput.manufacturer),
    nafdacNumber: optionalString(recordInput.nafdacNumber),
    barcodes,
    reorderLevel: Number(recordInput.reorderLevel) || 0,
    active: recordInput.active !== false,
  };
}

function saveMedicineRecord(
  db: Database,
  actorId: string,
  actor: User,
  actorRole: Role,
  branchId: string | undefined,
  record: Medicine,
) {
  const before = db.medicines.find((medicine) => medicine.id === record.id);
  const canSetPrices = canManageMedicinePrices(db, actor, actorRole, branchId);
  if (canSetPrices && pricingPolicy(db.settings).enabled) {
    const pricingDb = { ...db, medicines: [...db.medicines.filter(item => item.id !== record.id), record] };
    record.sellingPrice = calculatedSellingPrice(pricingDb, "medicine", record.id, record.costPrice);
  }
  if (!canSetPrices) {
    record.costPrice = before?.costPrice ?? 0;
    record.sellingPrice = before?.sellingPrice ?? 0;
  }
  if (!record.barcodes.length)
    record.barcodes = [generateMedicineBarcode(db, record.id)];
  const recordBarcodes = new Set(
    record.barcodes.map((code) => code.toLowerCase()),
  );
  const duplicateBarcode = db.medicines.find(
    (medicine) =>
      medicine.id !== record.id &&
      medicine.barcodes.some((code) => recordBarcodes.has(code.toLowerCase())),
  );
  if (duplicateBarcode)
    throw new Error(`Barcode already belongs to ${duplicateBarcode.brandName}`);
  const duplicateProductBarcode = db.products.find((product) =>
    product.barcodes.some((code) => recordBarcodes.has(code.toLowerCase())),
  );
  if (duplicateProductBarcode)
    throw new Error(
      `Barcode already belongs to ${duplicateProductBarcode.name}`,
    );
  const duplicateSku = db.medicines.find(
    (medicine) =>
      medicine.id !== record.id &&
      medicine.sku.toLowerCase() === record.sku.toLowerCase(),
  );
  if (duplicateSku)
    throw new Error(`SKU already belongs to ${duplicateSku.brandName}`);
  const identityKey = medicineDuplicateKey(record);
  const likelyDuplicate = db.medicines.find(
    (medicine) =>
      medicine.id !== record.id &&
      medicineDuplicateKey(medicine) === identityKey,
  );
  if (likelyDuplicate)
    throw new Error(
      `Likely duplicate medicine: ${likelyDuplicate.brandName} has the same generic, form, strength, and NAFDAC/brand identity`,
    );
  db.medicines = before
    ? db.medicines.map((medicine) =>
        medicine.id === record.id ? record : medicine,
      )
    : [record, ...db.medicines];
  addAudit(
    db,
    actorId,
    before ? "Updated medicine record" : "Created medicine record",
    "medicine",
    record.id,
    before,
    record,
  );
}

function medicineDuplicateKey(medicine: Medicine) {
  return [
    medicine.brandName,
    medicine.genericName,
    medicine.form,
    medicine.strength,
    medicine.nafdacNumber || medicine.sku,
  ]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

function upsertProduct(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  const productManager =
    actor &&
    (canWrite({ ...actor, role: actorRole }) ||
      actorRole === "cashier" ||
      canManageBranch(
        actor,
        actor.branchIds[0] || actor.managedBranchIds[0] || "",
        getPrimaryAdminId(db),
      ));
  if (!actor || !productManager)
    throw new Error("You do not have permission to save products");
  const branchId = requireString(payload?.branchId, "Branch");
  if (!db.branches.some(branch => branch.id === branchId && branch.active))
    throw new Error("Active branch not found");
  if (!canAdmin(actor, getPrimaryAdminId(db)) && !hasActiveBranchAssignment(actor, branchId))
    throw new Error("You do not have permission to change stock in this branch");
  const input = (payload?.record ?? {}) as Partial<Product>;
  const costPrice = Number(input.costPrice) || 0;
  const provisionalId = input.id || id("prd");
  const pricingDb = { ...db, products: [...db.products.filter(item => item.id !== provisionalId),
    { ...input, id: provisionalId, sku: input.sku || "", name: input.name || "", category: input.category || "General retail" } as Product] };
  const sellingPrice = pricingPolicy(db.settings).enabled
    ? calculatedSellingPrice(pricingDb, "product", provisionalId, costPrice)
    : Number(input.sellingPrice) || 0;
  if (sellingPrice > 0 && sellingPrice < costPrice)
    throw new Error(
      "Selling price must be equal to or greater than cost price",
    );
  const barcodes = Array.isArray(input.barcodes)
    ? input.barcodes
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const record: Product = {
    id: provisionalId,
    sku: requireString(input.sku, "SKU"),
    name: requireString(input.name, "Product name"),
    category: optionalString(input.category) || "General retail",
    unit: optionalString(input.unit) || "Unit",
    costPrice,
    sellingPrice,
    quantity: Math.max(0, Number(input.quantity) || 0),
    barcodes,
    supplierId: optionalString(input.supplierId),
    active: input.active !== false,
    createdAt: input.createdAt || nowIso(),
  };
  const duplicateSku = db.products.find(
    (product) =>
      product.id !== record.id &&
      product.sku.toLowerCase() === record.sku.toLowerCase(),
  );
  if (duplicateSku)
    throw new Error(`SKU already belongs to ${duplicateSku.name}`);
  const duplicateBarcode = db.products.find(
    (product) =>
      product.id !== record.id &&
      product.barcodes.some((code) => record.barcodes.includes(code)),
  );
  if (duplicateBarcode)
    throw new Error(`Barcode already belongs to ${duplicateBarcode.name}`);
  const before = db.products.find((product) => product.id === record.id);
  const currentBranchQuantity = productQuantityInBranches(db, record.id, [branchId]);
  const requestedBranchQuantity = record.quantity;
  const difference = requestedBranchQuantity - currentBranchQuantity;
  record.quantity = Math.max(0, (before?.quantity ?? 0) + difference);
  if (difference !== 0) db.ledger.unshift({
    id: id("led"), itemType: "product", medicineId: "", productId: record.id,
    batchId: "", type: "adjustment", quantity: difference,
    reason: before ? "Branch product stock correction" : "Opening branch product stock",
    reference: record.sku, userId: actorId, createdAt: nowIso(), toBranchId: branchId,
  });
  db.products = before
    ? db.products.map((product) =>
        product.id === record.id ? record : product,
      )
    : [record, ...db.products];
  addAudit(
    db,
    actorId,
    before ? "Updated product record" : "Created product record",
    "product",
    record.id,
    before,
    record,
  );
}

function upsertSupplier(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor || !canWrite({ ...actor, role: actorRole }))
    throw new Error("You do not have permission to save suppliers");
  const input = (payload?.record ?? {}) as Partial<Supplier>;
  const record: Supplier = {
    id: input.id || id("sup"),
    name: requireString(input.name, "Supplier name"),
    contact: optionalString(input.contact),
    address: optionalString(input.address),
    licenseRef: optionalString(input.licenseRef),
    active: input.active !== false,
  };
  const before = db.suppliers.find((supplier) => supplier.id === record.id);
  db.suppliers = before
    ? db.suppliers.map((supplier) =>
        supplier.id === record.id ? record : supplier,
      )
    : [record, ...db.suppliers];
  addAudit(
    db,
    actorId,
    before ? "Updated supplier" : "Created supplier",
    "supplier",
    record.id,
    before,
    record,
  );
}

function upsertBranch(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  const input = (payload?.record ?? {}) as Partial<Branch>;
  if (!actor) throw new Error("Authentication required");
  const primaryAdminId = getPrimaryAdminId(db);
  if (!input.id && !canAdmin({ ...actor, role: actorRole }, primaryAdminId))
    throw new Error("Only the permanent admin can create branches");
  if (input.id && !canManageBranch(actor, input.id, primaryAdminId))
    throw new Error(
      "Only this branch manager or the permanent admin can save this branch",
    );
  const name = requireString(input.name, "Branch name");
  const managerUserId = optionalString(input.managerUserId);
  if (managerUserId && !canAdmin({ ...actor, role: actorRole }, primaryAdminId))
    throw new Error("Only the permanent admin can assign branch managers");
  if (managerUserId) {
    if (managerUserId === primaryAdminId)
      throw new Error(
        "The permanent admin remains global and should not be assigned as a branch manager",
      );
    const manager = db.users.find(
      (user) => user.id === managerUserId && user.status === "active",
    );
    if (!manager) throw new Error("Manager user not found");
    if (manager.role === "viewer" || manager.role === "cashier")
      throw new Error("Cashiers and viewers cannot be branch managers");
  }
  const record: Branch = {
    id: input.id || id("br"),
    name,
    code:
      optionalString(input.code) ||
      name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 12) ||
      "BRANCH",
    address: optionalString(input.address),
    managerName: optionalString(input.managerName),
    managerUserId,
    phone: optionalString(input.phone),
    active: input.id === "main" ? true : input.active !== false,
    createdAt: input.createdAt || nowIso(),
  };
  const duplicateCode = db.branches.find(
    (branch) =>
      branch.id !== record.id &&
      branch.code.toLowerCase() === record.code.toLowerCase(),
  );
  if (duplicateCode)
    throw new Error(`Branch code already belongs to ${duplicateCode.name}`);
  const before = db.branches.find((branch) => branch.id === record.id);
  db.branches = before
    ? db.branches.map((branch) => (branch.id === record.id ? record : branch))
    : [record, ...db.branches];
  if (record.id === "main") db.settings.branchName = record.name;
  if (before?.managerUserId && before.managerUserId !== record.managerUserId) {
    const previousManager = db.users.find(
      (user) => user.id === before.managerUserId,
    );
    if (previousManager && previousManager.id !== primaryAdminId) {
      previousManager.managedBranchIds =
        previousManager.managedBranchIds.filter((id) => id !== record.id);
      previousManager.branchIds = previousManager.branchIds.filter(
        (id) => id !== record.id,
      );
      delete previousManager.branchAccessExpiresAt?.[record.id];
    }
  }
  if (record.managerUserId) {
    const manager = db.users.find((user) => user.id === record.managerUserId);
    if (manager) {
      db.branches = db.branches.map((branch) =>
        branch.id !== record.id && branch.managerUserId === manager.id
          ? { ...branch, managerUserId: "", managerName: "" }
          : branch,
      );
      manager.branchIds = [record.id];
      manager.managedBranchIds = [record.id];
      manager.branchAccessExpiresAt = {};
      db.branchAccessRequests = db.branchAccessRequests.map((request) =>
        request.userId === manager.id &&
        request.branchId === record.id &&
        request.status === "pending"
          ? {
              ...request,
              status: "approved",
              updatedAt: nowIso(),
              resolvedAt: nowIso(),
              resolvedBy: actorId,
            }
          : request,
      );
    }
  }
  addAudit(
    db,
    actorId,
    before ? "Updated branch" : "Created branch",
    "branch",
    record.id,
    before,
    record,
  );
}

function receiveStock(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor || !canWrite({ ...actor, role: actorRole }))
    throw new Error("You do not have permission to receive stock");
  const supplierId = requireString(payload?.supplierId, "Supplier");
  if (!db.suppliers.some((supplier) => supplier.id === supplierId))
    throw new Error("Supplier not found");
  const branchId =
    optionalString(payload?.branchId) ||
    db.branches.find((branch) => branch.active)?.id ||
    "main";
  if (!db.branches.some((branch) => branch.id === branchId && branch.active))
    throw new Error("Active branch not found");
  if (!canWriteBranch(actor, branchId, getPrimaryAdminId(db)))
    throw new Error("You only have view access in this branch");
  const inputs = Array.isArray(payload?.items)
    ? (payload.items as Record<string, unknown>[])
    : [
        {
          itemType: "medicine",
          medicineId: payload?.medicineId,
          itemId: payload?.medicineId,
          batchNumber: payload?.batchNumber,
          expiryDate: payload?.expiryDate,
          quantity: payload?.quantity,
          unitCost: payload?.unitCost,
          sellingPrice: payload?.sellingPrice,
          location: payload?.location,
        },
      ];
  if (!inputs.length) throw new Error("Add at least one stock line");
  const reference = optionalString(payload?.invoiceRef) || "Manual receive";
  const receipt = {
    id: id("grn"),
    supplierId,
    invoiceRef: reference,
    receivedAt: nowIso(),
    userId: actorId,
    items: [] as Database["receipts"][number]["items"],
  };
  const batches = [];
  const ledgerEntries = [];
  for (const input of inputs) {
    const itemType = input.itemType === "product" ? "product" : "medicine";
    if (itemType === "product") {
      const productId = requireString(
        input.productId || input.itemId,
        "Product",
      );
      const product = db.products.find(
        (item) => item.id === productId && item.active,
      );
      if (!product) throw new Error("Active product not found");
      const quantity = requireNumber(input.quantity, "Quantity");
      if (quantity <= 0) throw new Error("Quantity must be greater than zero");
      const batchNumber = optionalString(input.batchNumber);
      const expiryDate = optionalString(input.expiryDate);
      if (expiryDate && expiryDate < today())
        throw new Error("Expiry date must be today or a future date");
      const unitCost = input.unitCost === undefined || input.unitCost === ""
        ? product.costPrice || 0 : requireNumber(input.unitCost, "Unit cost") || product.costPrice || 0;
      if (unitCost < 0) throw new Error("Unit cost cannot be negative");
      const sellingPrice = pricingPolicy(db.settings).enabled
        ? calculatedSellingPrice(db, "product", productId, unitCost)
        : input.sellingPrice === undefined || input.sellingPrice === ""
          ? product.sellingPrice || 0 : requireNumber(input.sellingPrice, "Selling price") || product.sellingPrice || 0;
      if (sellingPrice < 0) throw new Error("Selling price cannot be negative");
      if (sellingPrice > 0 && sellingPrice < unitCost)
        throw new Error("Selling price cannot be lower than unit cost");
      const beforeProduct = { ...product };
      product.quantity += quantity;
      if (unitCost > 0) product.costPrice = unitCost;
      if (sellingPrice > 0) product.sellingPrice = sellingPrice;
      const location = optionalString(input.location) || "Main Store";
      const ledger = {
        id: id("led"),
        itemType: "product" as const,
        medicineId: "",
        productId,
        batchId: "",
        batchNumber,
        expiryDate,
        unitCost,
        sellingPrice,
        location,
        type: "stock-in" as LedgerType,
        quantity,
        reason: "Goods received",
        reference,
        userId: actorId,
        createdAt: nowIso(),
        toBranchId: branchId,
      };
      ledgerEntries.push(ledger);
      receipt.items.push({
        itemType: "product",
        medicineId: "",
        productId,
        batchId: "",
        batchNumber,
        expiryDate,
        sellingPrice,
        location,
        branchId,
        quantity,
        unitCost,
      });
      addAudit(
        db,
        actorId,
        `Received product stock for ${product.name}`,
        "product",
        productId,
        beforeProduct,
        {
          ...product,
          receivedQuantity: quantity,
          receipt: reference,
          batchNumber,
          expiryDate,
          location,
        },
      );
      continue;
    }
    const medicineId = requireString(
      input.medicineId || input.itemId,
      "Medicine",
    );
    const medicine = db.medicines.find((item) => item.id === medicineId);
    if (!medicine) throw new Error("Medicine not found");
    const containerQuantity = requireNumber(
      input.quantity,
      "Container quantity",
    );
    if (containerQuantity <= 0)
      throw new Error("Container quantity must be greater than zero");
    const unitsPerContainer = Math.max(1, Number(medicine.packSize) || 1);
    const quantity = containerQuantity * unitsPerContainer;
    const expiryDate = requireString(input.expiryDate, "Expiry date");
    if (expiryDate < today())
      throw new Error("Expiry date must be today or a future date");
    const containerCost = input.unitCost === undefined || input.unitCost === ""
      ? (medicine.costPrice > 0 ? medicine.costPrice * unitsPerContainer : 0)
      : requireNumber(input.unitCost, "Container cost");
    if (containerCost < 0) throw new Error("Container cost cannot be negative");
    const unitCost =
      containerCost > 0
        ? containerCost / unitsPerContainer
        : medicine.costPrice || 0;
    const sellingPrice = pricingPolicy(db.settings).enabled
      ? calculatedSellingPrice(db, "medicine", medicineId, unitCost)
      : input.sellingPrice === undefined || input.sellingPrice === ""
        ? medicine.sellingPrice || 0 : requireNumber(input.sellingPrice, "Selling price") || medicine.sellingPrice || 0;
    if (sellingPrice < 0) throw new Error("Selling price cannot be negative");
    if (sellingPrice > 0 && sellingPrice < unitCost)
      throw new Error("Selling price cannot be lower than unit cost");
    const beforeMedicine = { ...medicine };
    if (unitCost > 0) medicine.costPrice = unitCost;
    if (sellingPrice > 0) medicine.sellingPrice = sellingPrice;
    const batch = {
      id: id("bat"),
      medicineId,
      supplierId,
      batchNumber: requireString(input.batchNumber, "Batch number"),
      expiryDate,
      unitCost,
      sellingPrice,
      receivedDate: today(),
      location: optionalString(input.location) || "Main Store",
      branchId,
    };
    const ledger = {
      id: id("led"),
      itemType: "medicine" as const,
      medicineId,
      batchId: batch.id,
      type: "stock-in" as LedgerType,
      quantity,
      reason: "Goods received",
      reference,
      userId: actorId,
      createdAt: nowIso(),
    };
    batches.push(batch);
    ledgerEntries.push(ledger);
    receipt.items.push({
      itemType: "medicine",
      medicineId,
      batchId: batch.id,
      quantity,
      unitCost: batch.unitCost,
      sellingPrice,
      location: batch.location,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      branchId,
    });
    if (unitCost > 0 || sellingPrice > 0) {
      addAudit(
        db,
        actorId,
        `Updated catalog pricing from receipt for ${medicine.brandName}`,
        "medicine",
        medicineId,
        beforeMedicine,
        {
          costPrice: medicine.costPrice,
          sellingPrice: medicine.sellingPrice,
          receipt: reference,
        },
      );
    }
  }
  db.batches.unshift(...batches);
  db.ledger.unshift(...ledgerEntries);
  db.receipts.unshift(receipt);
  receipt.items
    .filter((item) => item.itemType !== "product" && item.medicineId)
    .forEach((item) =>
      matchContinuityRequestsForMedicine(
        db,
        actorId,
        item.medicineId,
        item.branchId || branchId,
      ),
    );
  addAudit(
    db,
    actorId,
    `Received ${receipt.items.length} stock line${receipt.items.length > 1 ? "s" : ""}`,
    "receipt",
    receipt.id,
    undefined,
    receipt,
  );
}

function getBatchAvailable(db: Database, batchId: string) {
  return db.ledger
    .filter((entry) => entry.batchId === batchId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

function normalizeContactPhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function availableMedicineQuantity(db: Database, medicineId: string, branchId: string) {
  return db.batches
    .filter((batch) => batch.branchId === branchId && batch.medicineId === medicineId)
    .reduce((sum, batch) => {
      if (daysUntil(batch.expiryDate) < 0) return sum;
      return sum + Math.max(0, getBatchAvailable(db, batch.id));
    }, 0);
}

function bestContinuityBranch(db: Database, medicineId: string, preferredBranchId = "") {
  const candidates = db.branches
    .filter((branch) => branch.active)
    .map((branch) => ({
      branchId: branch.id,
      quantity: availableMedicineQuantity(db, medicineId, branch.id),
    }))
    .filter((entry) => entry.quantity > 0);
  return (
    candidates.find((entry) => entry.branchId === preferredBranchId) ??
    candidates[0]
  );
}

function matchContinuityRequestsForMedicine(
  db: Database,
  actorId: string,
  medicineId: string,
  matchedBranchId: string,
) {
  db.continuityRequests
    .filter(
      (request) =>
        request.medicineId === medicineId &&
        (request.status === "open" || request.status === "contacted") &&
        availableMedicineQuantity(db, medicineId, matchedBranchId) > 0,
    )
    .forEach((request) => {
      const before = { ...request };
      request.status = "matched";
      request.matchedBranchId = matchedBranchId;
      request.matchedAt = nowIso();
      request.updatedAt = nowIso();
      addAudit(
        db,
        actorId,
        "Matched continuity request to available stock",
        "continuity-request",
        request.id,
        before,
        { ...request },
      );
    });
}

function createContinuityRequest(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  const originBranchId = optionalString(payload?.originBranchId) || optionalString(payload?.branchId) || "main";
  if (!db.branches.some((branch) => branch.id === originBranchId && branch.active))
    throw new Error("Active branch not found");
  if (!canSellInBranch(db, { ...actor, role: actorRole }, originBranchId))
    throw new Error("You do not have permission to create continuity requests in this branch");
  const medicineId = requireString(payload?.medicineId, "Medicine");
  const medicine = db.medicines.find((item) => item.id === medicineId && item.active);
  if (!medicine) throw new Error("Active medicine not found");
  const patientName = optionalString(payload?.patientName) || "Walk-in patient";
  const patientPhone = optionalString(payload?.patientPhone);
  const patient = payload?.patientId ? canonicalPatient(db.patients || [],optionalString(payload.patientId)) : undefined;
  if (payload?.patientId && (!patient || !patientMatchesPhone(patient,patientPhone) || !patientMatchesName(patient,patientName)))
    throw new Error("Select the correct workspace patient for this continuity request");
  if (!patientPhone && patientName === "Walk-in patient")
    throw new Error("Add a patient name or phone number for continuity follow-up");
  const normalizedPhone = normalizeContactPhone(patientPhone);
  const duplicate = normalizedPhone
    ? db.continuityRequests.find(
        (request) =>
          request.originBranchId===originBranchId &&
          (patient ? request.patientId===patient.id : !request.patientId && normalizeContactPhone(request.patientPhone)===normalizedPhone && normalizePatientName(request.patientName)===normalizePatientName(patientName)) &&
          request.medicineId === medicineId &&
          !["fulfilled", "cancelled"].includes(request.status),
      )
    : undefined;
  if (duplicate)
    throw new Error("This patient already has an active continuity request for this medicine");
  const urgency =
    payload?.urgency === "urgent" || payload?.urgency === "important"
      ? payload.urgency
      : "routine";
  const preferredBranchId = optionalString(payload?.preferredBranchId);
  if (
    preferredBranchId &&
    !db.branches.some((branch) => branch.id === preferredBranchId && branch.active)
  ) {
    throw new Error("Preferred branch not found");
  }
  if (preferredBranchId && !canAdmin(actor, getPrimaryAdminId(db)) && !hasActiveBranchAssignment(actor, preferredBranchId))
    throw new Error("You do not have access to the preferred branch");
  const bestBranch = bestContinuityBranch(scopeDatabaseForUser(db, actor), medicineId, preferredBranchId || originBranchId);
  const request: Database["continuityRequests"][number] = {
    id: id("ctr"),
    patientName,
    patientPhone,
    patientId: patient?.id,
    medicineId,
    requestedMedicineName: optionalString(payload?.requestedMedicineName) || medicine.brandName,
    quantityRequested: Math.max(1, Number(payload?.quantityRequested) || 1),
    originBranchId,
    preferredBranchId: preferredBranchId || undefined,
    matchedBranchId: bestBranch?.branchId,
    status: bestBranch ? "matched" : "open",
    urgency,
    source: payload?.source === "manual" ? "manual" : "pos",
    note: optionalString(payload?.note) || undefined,
    createdBy: actorId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    matchedAt: bestBranch ? nowIso() : undefined,
  };
  db.continuityRequests.unshift(request);
  addAudit(
    db,
    actorId,
    "Created continuity request",
    "continuity-request",
    request.id,
    undefined,
    request,
  );
}

function updateContinuityRequest(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  const requestId = requireString(payload?.requestId, "Continuity request");
  const request = db.continuityRequests.find((item) => item.id === requestId);
  if (!request) throw new Error("Continuity request not found");
  const canAct = canSellInBranch(db, { ...actor, role: actorRole }, request.originBranchId);
  if (!canAct)
    throw new Error("You do not have permission to update this continuity request");
  const before = { ...request };
  const status = optionalString(payload?.status);
  if (status) {
    if (
      status !== "open" &&
      status !== "matched" &&
      status !== "contacted" &&
      status !== "transferred" &&
      status !== "fulfilled" &&
      status !== "cancelled"
    ) {
      throw new Error("Unsupported continuity status");
    }
    request.status = status;
    if (status === "matched") request.matchedAt = request.matchedAt || nowIso();
    if (status === "contacted") request.contactedAt = nowIso();
    if (status === "transferred") {
      request.note = [
        request.note,
        optionalString(payload?.note) || "Transfer requested between branches.",
      ]
        .filter(Boolean)
        .join(" ");
    }
    if (status === "fulfilled") {
      request.fulfilledAt = nowIso();
      request.closedAt = nowIso();
    }
    if (status === "cancelled") request.closedAt = nowIso();
  }
  if ("note" in (payload ?? {})) request.note = optionalString(payload?.note) || undefined;
  const preferredBranchId = optionalString(payload?.preferredBranchId);
  if (preferredBranchId) {
    if (!canAdmin(actor, getPrimaryAdminId(db)) && !hasActiveBranchAssignment(actor, preferredBranchId))
      throw new Error("You do not have access to the preferred branch");
    if (!db.branches.some((branch) => branch.id === preferredBranchId && branch.active))
      throw new Error("Preferred branch not found");
    request.preferredBranchId = preferredBranchId;
  }
  request.updatedAt = nowIso();
  addAudit(
    db,
    actorId,
    "Updated continuity request",
    "continuity-request",
    request.id,
    before,
    { ...request },
  );
}

function normalizePatientDetails(value: unknown, previous?: PatientDetails): PatientDetails | undefined {
  if (value === undefined) return previous;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid patient details");
  const input = value as Record<string, unknown>;
  const age = input.age === undefined || input.age === null || input.age === "" ? undefined : Number(input.age);
  if (age !== undefined && (!Number.isInteger(age) || age < 0 || age > 130)) throw new Error("Patient age must be a whole number from 0 to 130");
  const gender = optionalString(input.gender) || undefined;
  if (gender && !["female", "male", "other", "prefer_not_to_say"].includes(gender)) throw new Error("Invalid patient gender");
  const allergyStatus = optionalString(input.allergyStatus) || "unknown";
  if (!["unknown", "none", "recorded"].includes(allergyStatus)) throw new Error("Invalid allergy status");
  const allergies = allergyStatus === "recorded" ? optionalString(input.allergies) : "";
  if (allergyStatus === "recorded" && !allergies) throw new Error("Describe the documented allergies");
  if (allergies.length > 2000) throw new Error("Allergy details must be at most 2000 characters");
  const now = nowIso();
  return {age, gender:gender as PatientDetails["gender"], allergyStatus:allergyStatus as PatientDetails["allergyStatus"], allergies, updatedAt:now,
    ageRecordedAt:age === undefined ? undefined : previous?.age === age ? previous.ageRecordedAt || previous.updatedAt || now : now};
}

function patientRegistryActor(db: Database, actorId: string, branchId: string) {
  const actor = db.users.find(user => user.id === actorId);
  if (!actor || !canAccessPatientRegistry(db, actor) || !db.branches.some(branch => branch.id === branchId && branch.active) ||
      (!canAdmin(actor, getPrimaryAdminId(db)) && !hasActiveBranchAssignment(actor, branchId)))
    throw new Error("You do not have permission to use the patient registry in this branch");
  return actor;
}
function registryPhone(value: unknown) {
  const phone = requireString(value, "Patient phone");
  if (!/^\d{7,15}$/.test(canonicalPhone(phone))) throw new Error("Enter a valid patient phone number, including the country code where needed");
  return phone;
}
function createRegistryPatient(db: Database, actorId: string, payload: Record<string, unknown> | undefined): PatientRecord {
  const branchId = requireString(payload?.branchId, "Branch");
  patientRegistryActor(db, actorId, branchId);
  const name = requireString(payload?.patientName, "Patient name");
  const phone = registryPhone(payload?.patientPhone);
  const normalizedPhone = canonicalPhone(phone);
  const candidates = (db.patients || []).filter(patient => !patient.mergedIntoId && patientMatchesPhone(patient,phone));
  if (candidates.some(patient => patientMatchesName(patient,name)))
    throw new Error("This patient already exists. Select their existing workspace profile.");
  const sharedPhoneReason = optionalString(payload?.sharedPhoneReason);
  if (candidates.length && !sharedPhoneReason)
    throw new Error("This phone is already registered. Select the patient or explain why a different person shares this contact.");
  const now = nowIso();
  const patient: PatientRecord = {id:id("patient"), name, phone, normalizedPhone,
    details:normalizePatientDetails(payload?.patientDetails || {allergyStatus:"unknown"})!,
    createdAt:now,updatedAt:now,revision:1,createdBy:actorId,updatedBy:actorId,sharedPhoneReason:sharedPhoneReason || undefined};
  db.patients = [...(db.patients || []),patient];
  addAudit(db,actorId,"Registered workspace patient","patient",patient.id,undefined,patient);
  return patient;
}
function updateRegistryPatient(db: Database, actorId: string, payload: Record<string, unknown> | undefined): PatientRecord {
  patientRegistryActor(db,actorId,requireString(payload?.branchId,"Branch"));
  const patient = canonicalPatient(db.patients || [],requireString(payload?.patientId,"Patient"));
  if (!patient) throw new Error("Patient not found in this workspace");
  if (patient.id!==payload?.patientId || Number(payload?.expectedRevision)!==(patient.revision || 0))
    throw new Error("This patient profile changed or was merged. Refresh it and review the latest details before saving.");
  const name = requireString(payload?.patientName,"Patient name");
  const phone = registryPhone(payload?.patientPhone);
  const normalizedPhone = canonicalPhone(phone);
  const other = (db.patients || []).filter(item => !item.mergedIntoId && item.id !== patient.id && patientMatchesPhone(item,phone));
  if (other.some(item => patientMatchesName(item,name)) || (other.length && normalizedPhone !== patient.normalizedPhone))
    throw new Error("This contact matches another profile. Review the existing patient before changing identity or request an owner-reviewed merge.");
  const before = structuredClone(patient);
  const contactAliases = [...new Set([...(patient.contactAliases || []),...(normalizedPhone!==patient.normalizedPhone?[patient.phone]:[])])];
  const nameAliases = [...new Set([...(patient.nameAliases || []),...(normalizePatientName(name)!==normalizePatientName(patient.name)?[patient.name]:[])])];
  Object.assign(patient,{contactAliases,nameAliases,revision:(patient.revision || 0)+1,name,phone,normalizedPhone,details:normalizePatientDetails(payload?.patientDetails,patient.details),needsReview:false,updatedAt:nowIso(),updatedBy:actorId});
  addAudit(db,actorId,"Updated workspace patient","patient",patient.id,before,{...patient});
  return patient;
}
function mergeRegistryPatients(db: Database, actorId: string, payload: Record<string, unknown> | undefined): PatientRecord {
  const actor = db.users.find(user => user.id === actorId);
  if (!actor || !canAdmin(actor,getPrimaryAdminId(db))) throw new Error("Only the workspace owner can merge patient identities");
  const source = canonicalPatient(db.patients || [],requireString(payload?.sourcePatientId,"Source patient"));
  const target = canonicalPatient(db.patients || [],requireString(payload?.targetPatientId,"Target patient"));
  if (!source || !target || source.id === target.id) throw new Error("Choose two distinct patients in this workspace");
  if (source.id!==payload?.sourcePatientId || target.id!==payload?.targetPatientId || Number(payload?.sourceRevision)!==(source.revision || 0) || Number(payload?.targetRevision)!==(target.revision || 0))
    throw new Error("A patient profile changed. Refresh and review both identities before merging.");
  const reason = requireString(payload?.reason,"Identity confirmation reason");
  if (payload?.identityConfirmed !== true || !payload.patientDetails) throw new Error("Confirm the same person and review allergy details before merging");
  const details = normalizePatientDetails(payload.patientDetails,target.details)!;
  const sourceIds = new Set((db.patients || []).filter(item => canonicalPatient(db.patients || [],item.id)?.id === source.id).map(item=>item.id));
  const before = {source:structuredClone(source),target:structuredClone(target)};
  const relinked = {sales:0,drafts:0,continuity:0};
  db.sales.forEach(sale=>{if (sale.patientId && sourceIds.has(sale.patientId)){sale.patientId=target.id;relinked.sales++;}});
  db.posDrafts.forEach(draft=>{if (draft.patientId && sourceIds.has(draft.patientId)){draft.patientId=target.id;relinked.drafts++;}});
  db.continuityRequests.forEach(request=>{if (request.patientId && sourceIds.has(request.patientId)){request.patientId=target.id;relinked.continuity++;}});
  source.revision=(source.revision || 0)+1;target.revision=(target.revision || 0)+1;
  source.mergedIntoId=target.id;source.updatedAt=nowIso();source.updatedBy=actorId;
  target.contactAliases=[...new Set([...(target.contactAliases || []),source.phone,...(source.contactAliases || [])])].filter(phone=>canonicalPhone(phone)!==target.normalizedPhone);
  target.nameAliases=[...new Set([...(target.nameAliases || []),source.name,...(source.nameAliases || [])])].filter(name=>normalizePatientName(name)!==normalizePatientName(target.name));
  target.details=details;target.updatedAt=nowIso();target.updatedBy=actorId;target.needsReview=false;
  addAudit(db,actorId,"Merged confirmed patient identities","patient",target.id,before,{source:{...source},target:{...target},reason,relinked});
  return target;
}
function patientCareHistoryForUser(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const branchId=requireString(payload?.branchId,"Branch");
  const actor=patientRegistryActor(db,actorId,branchId);
  if (actor.role !== "pharmacist" && !canManageBranch(actor,branchId,getPrimaryAdminId(db)))
    throw new Error("Cross-branch medication history requires pharmacist or branch-manager access");
  const patient=canonicalPatient(db.patients || [],requireString(payload?.patientId,"Patient"));
  if (!patient) throw new Error("Patient not found in this workspace");
  const visits=db.sales.filter(sale=>canonicalPatient(db.patients || [],sale.patientId)?.id===patient.id)
    .sort((a,b)=>b.soldAt.localeCompare(a.soldAt)).map(sale=>({id:sale.id,date:sale.soldAt,branchName:db.branches.find(branch=>branch.id===sale.branchId)?.name || "Workspace branch",
      items:sale.items.filter(item=>item.itemType==="medicine").map(item=>({name:item.itemName || db.medicines.find(medicine=>medicine.id===item.medicineId)?.brandName || "Medicine",quantity:item.quantity,daysSupply:item.daysSupply,instruction:item.labelInstruction}))})).filter(visit=>visit.items.length);
  addAudit(db,actorId,"Viewed cross-branch patient care history","patient",patient.id,undefined,{patientId:patient.id,branchId,visitCount:visits.length});
  return visits;
}
function transactionText(payload: Record<string, unknown> | undefined, key: string, fallback = "") {
  return typeof payload?.[key] === "string" ? (payload[key] as string).trim() : fallback;
}
function matchingPatientDraft(patient: PatientRecord | undefined, payload: Record<string, unknown> | undefined, draft?: PosDraft) {
  if (!draft) return undefined;
  if (patient) return draft.patientId===patient.id ? draft : undefined;
  return !draft.patientId && canonicalPhone(transactionText(payload,"customerPhone",draft.customerPhone))===canonicalPhone(draft.customerPhone) &&
    normalizePatientName(transactionText(payload,"customerName",draft.customerName))===normalizePatientName(draft.customerName) ? draft : undefined;
}

function patientForTransaction(db: Database, actorId: string, branchId: string, payload: Record<string, unknown> | undefined, draft?: PosDraft) {
  if (!db.patients) return undefined; // Compatibility for unnormalised legacy fixtures/callers.
  const patientId = "patientId" in (payload || {}) ? optionalString(payload?.patientId) : draft?.patientId;
  const name = typeof payload?.customerName === "string" ? payload.customerName.trim() : draft?.customerName || "";
  const phone = typeof payload?.customerPhone === "string" ? payload.customerPhone.trim() : draft?.customerPhone || "";
  if (patientId) {
    const patient=canonicalPatient(db.patients,patientId);
    if (!patient) throw new Error("Patient not found in this workspace");
    if (!patientMatchesPhone(patient,phone) || (name && !patientMatchesName(patient,name)))
      throw new Error("Patient contact or name changed. Select the correct workspace profile again.");
    return patient;
  }
  if (!phone) return undefined;
  if (db.patients.some(patient=>!patient.mergedIntoId && patientMatchesPhone(patient,phone)))
    throw new Error("This contact already has a workspace patient. Select the correct profile or register a different person sharing the number. Refresh POS if the registry is not shown.");
  if (!name) throw new Error("Enter the patient's name to register this contact, or leave the sale anonymous.");
  return createRegistryPatient(db,actorId,{branchId,patientName:name,patientPhone:phone,patientDetails:payload?.patientDetails});
}

function patientDetailsForSale(db: Database, branchId: string, phone: string, value: unknown, draft?: PosDraft, patientId?: string) {
  const registered = canonicalPatient(db.patients || [],patientId);
  if (registered) return registered.details;
  if (db.patients) return normalizePatientDetails(value);
  const key = normalizePatientPhone(phone);
  const history = key ? db.sales.filter(sale => sale.branchId === branchId && normalizePatientPhone(sale.customerPhone) === key && sale.patientDetails)
    .sort((a,b)=>(b.patientDetails?.updatedAt || b.soldAt).localeCompare(a.patientDetails?.updatedAt || a.soldAt))[0]?.patientDetails : undefined;
  // POS is read-only for existing profile details. A stale cart must not replace
  // a newer allergy correction made in Patients > Edit profile.
  if (history) return history;
  const previous = draft && key && normalizePatientPhone(draft.customerPhone) === key ? draft.patientDetails : undefined;
  return normalizePatientDetails(value, previous);
}

function updatePatientProfile(
  db: Database,
  actorId: string,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  if (actor.role === "viewer")
    throw new Error("Viewers cannot edit patient profiles");
  if (db.patients) throw new Error("Refresh RxLedger and use the workspace patient editor to update this shared profile safely.");
  const allowedBranches = accessibleBranchIds(actor, getPrimaryAdminId(db));
  const branchId = allowedBranches === null ? "" : requireString(payload?.branchId, "Branch");
  if (allowedBranches !== null && (!allowedBranches.includes(branchId) || !db.branches.some(branch => branch.id === branchId && branch.active)))
    throw new Error("You do not have access to this patient branch");
  const canEditBranch = (id: string) => allowedBranches === null || id === branchId;
  const oldPatientName = optionalString(payload?.oldPatientName);
  const oldPatientPhone = optionalString(payload?.oldPatientPhone);
  const patientName = requireString(payload?.patientName, "Patient name");
  const patientPhone = requireString(payload?.patientPhone, "Patient phone");
  const oldPhone = normalizePatientPhone(oldPatientPhone);
  const newPhone = normalizePatientPhone(patientPhone);
  if (!oldPhone && !oldPatientName)
    throw new Error("Original patient profile is required");
  if (!newPhone) throw new Error("Patient phone is required");

  const before = {
    oldPatientName,
    oldPatientPhone,
    matchingSales: db.sales
      .filter(
        (sale) =>
          canEditBranch(sale.branchId) && ((oldPhone && normalizePatientPhone(sale.customerPhone) === oldPhone) ||
          (!oldPhone &&
            sale.customerName.trim().toLowerCase() ===
              oldPatientName.trim().toLowerCase())),
      )
      .map((sale) => ({
        id: sale.id,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        patientDetails: sale.patientDetails,
      })),
    matchingContinuityRequests: db.continuityRequests
      .filter(
        (request) =>
          canEditBranch(request.originBranchId) && ((oldPhone && normalizePatientPhone(request.patientPhone) === oldPhone) ||
          (!oldPhone &&
            request.patientName.trim().toLowerCase() ===
              oldPatientName.trim().toLowerCase())),
      )
      .map((request) => ({
        id: request.id,
        patientName: request.patientName,
        patientPhone: request.patientPhone,
      })),
  };
  const previousDetails = db.sales.filter(sale => canEditBranch(sale.branchId) && normalizePatientPhone(sale.customerPhone) === oldPhone && sale.patientDetails)
    .sort((a,b)=>(b.patientDetails?.updatedAt || b.soldAt).localeCompare(a.patientDetails?.updatedAt || a.soldAt))[0]?.patientDetails;
  const patientDetails = normalizePatientDetails(payload?.patientDetails, previousDetails);
  let updatedSales = 0;
  let updatedContinuity = 0;
  db.sales.forEach((sale) => {
    if (!canEditBranch(sale.branchId)) return;
    const matches =
      (oldPhone && normalizePatientPhone(sale.customerPhone) === oldPhone) ||
      (!oldPhone &&
        sale.customerName.trim().toLowerCase() ===
          oldPatientName.trim().toLowerCase());
    if (!matches) return;
    sale.customerName = patientName;
    sale.customerPhone = patientPhone;
    if (patientDetails) sale.patientDetails = patientDetails;
    updatedSales += 1;
  });
  db.posDrafts.forEach((draft) => {
    if (!canEditBranch(draft.branchId)) return;
    const matches =
      (oldPhone && normalizePatientPhone(draft.customerPhone) === oldPhone) ||
      (!oldPhone &&
        draft.customerName.trim().toLowerCase() ===
          oldPatientName.trim().toLowerCase());
    if (!matches) return;
    draft.customerName = patientName;
    draft.customerPhone = patientPhone;
    if (patientDetails) draft.patientDetails = patientDetails;
    draft.updatedAt = nowIso();
  });
  db.continuityRequests.forEach((request) => {
    if (!canEditBranch(request.originBranchId)) return;
    const matches =
      (oldPhone && normalizePatientPhone(request.patientPhone) === oldPhone) ||
      (!oldPhone &&
        request.patientName.trim().toLowerCase() ===
          oldPatientName.trim().toLowerCase());
    if (!matches) return;
    request.patientName = patientName;
    request.patientPhone = patientPhone;
    request.updatedAt = nowIso();
    updatedContinuity += 1;
  });
  if (!updatedSales && !updatedContinuity)
    throw new Error("No matching patient records found");
  addAudit(
    db,
    actorId,
    `Updated patient profile for ${patientName}`,
    "patient-profile",
    newPhone || patientName,
    before,
    { patientName, patientPhone, patientDetails, branchId, updatedSales, updatedContinuity },
  );
}

function getUserRequestingBranches(db: Database, actorId: string) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) return [];
  if (canAdmin(actor, getPrimaryAdminId(db)))
    return db.branches.filter((branch) => branch.active);
  const branchIds = Array.from(
    new Set([...actor.branchIds, ...actor.managedBranchIds]),
  );
  return db.branches.filter(
    (branch) => branch.active && branchIds.includes(branch.id),
  );
}

function createRequisition(
  db: Database,
  actorId: string,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  const sourceBranchId = requireString(
    payload?.sourceBranchId,
    "Supplying branch",
  );
  const requestingBranchId = requireString(
    payload?.requestingBranchId,
    "Requesting branch",
  );
  if (sourceBranchId === requestingBranchId)
    throw new Error("Choose a different requesting branch");
  if (
    !db.branches.some((branch) => branch.id === sourceBranchId && branch.active)
  )
    throw new Error("Supplying branch not found");
  if (
    !db.branches.some(
      (branch) => branch.id === requestingBranchId && branch.active,
    )
  )
    throw new Error("Requesting branch not found");
  if (
    !getUserRequestingBranches(db, actorId).some(
      (branch) => branch.id === requestingBranchId,
    )
  ) {
    throw new Error("You can only request into a branch you work in");
  }
  if (!canAdmin(actor, getPrimaryAdminId(db)) && !hasActiveBranchAssignment(actor, sourceBranchId))
    throw new Error("You do not have access to the supplying branch");
  const inputs = Array.isArray(payload?.items)
    ? (payload.items as Record<string, unknown>[])
    : [];
  if (!inputs.length) throw new Error("Add at least one requisition item");
  const items = inputs.map((input) => {
    const batchId = requireString(input.batchId, "Batch");
    const batch = db.batches.find((item) => item.id === batchId);
    if (!batch || batch.branchId !== sourceBranchId)
      throw new Error("Batch is not available in the supplying branch");
    const medicineId = requireString(input.medicineId, "Medicine");
    if (
      batch.medicineId !== medicineId ||
      !db.medicines.some((medicine) => medicine.id === medicineId)
    )
      throw new Error("Medicine and batch do not match");
    const quantity = requireNumber(input.quantity, "Quantity");
    if (quantity <= 0) throw new Error("Quantity must be greater than zero");
    if (quantity > getBatchAvailable(db, batchId))
      throw new Error("Requested quantity exceeds current batch availability");
    return {
      id: id("reqitem"),
      medicineId,
      batchId,
      quantity,
    };
  });
  const request = {
    id: id("req"),
    requesterUserId: actorId,
    requestingBranchId,
    sourceBranchId,
    status: "pending" as const,
    items,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    note: optionalString(payload?.note),
  };
  db.requisitions.unshift(request);
  addAudit(
    db,
    actorId,
    "Created internal requisition",
    "requisition",
    request.id,
    undefined,
    request,
  );
}

function fulfillRequisition(
  db: Database,
  actorId: string,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  const requestId = requireString(payload?.requestId, "Requisition");
  const request = db.requisitions.find((item) => item.id === requestId);
  if (!request || request.status !== "pending")
    throw new Error("Pending requisition not found");
  if (!canWriteBranch(actor, request.sourceBranchId, getPrimaryAdminId(db)))
    throw new Error("You need branch posting access to fulfill this request");
  const before = {
    ...request,
    items: request.items.map((item) => ({ ...item })),
  };
  const releaseInputs = Array.isArray(payload?.items)
    ? (payload.items as Record<string, unknown>[])
    : [];
  const releaseByItem = new Map(
    releaseInputs.map((input) => [
      requireString(input.itemId ?? input.id, "Requisition item"),
      Math.max(0, requireNumber(input.quantity, "Release quantity")),
    ]),
  );
  const transferEntries = [];
  const transferBatches = [];
  let totalReleased = 0;
  const reference = `Requisition ${request.id}`;
  for (const item of request.items) {
    const sourceBatch = db.batches.find((batch) => batch.id === item.batchId);
    if (!sourceBatch) throw new Error("Source batch not found");
    const releaseQuantity = releaseByItem.has(item.id)
      ? (releaseByItem.get(item.id) ?? 0)
      : item.quantity;
    if (releaseQuantity > item.quantity)
      throw new Error("Release quantity cannot exceed requested quantity");
    if (releaseQuantity > getBatchAvailable(db, sourceBatch.id))
      throw new Error("A requested batch no longer has enough stock");
    item.releasedQuantity = releaseQuantity;
    item.fulfilledQuantity = releaseQuantity;
    if (releaseQuantity <= 0) continue;
    const destinationBatch = {
      ...sourceBatch,
      id: id("bat"),
      branchId: request.requestingBranchId,
      location: `Transfer from ${db.branches.find((branch) => branch.id === request.sourceBranchId)?.code || "branch"}`,
    };
    item.destinationBatchId = destinationBatch.id;
    transferBatches.push(destinationBatch);
    transferEntries.push({
      id: id("led"),
      medicineId: item.medicineId,
      batchId: sourceBatch.id,
      type: "stock-out" as LedgerType,
      quantity: -releaseQuantity,
      reason: "Internal requisition transfer",
      reference,
      userId: actorId,
      createdAt: nowIso(),
      fromBranchId: request.sourceBranchId,
      toBranchId: request.requestingBranchId,
    });
    totalReleased += releaseQuantity;
  }
  if (totalReleased <= 0)
    throw new Error(
      "Release at least one item quantity to fulfill this requisition",
    );
  db.batches.unshift(...transferBatches);
  db.ledger.unshift(...transferEntries);
  request.status = "released";
  request.releasedBy = actorId;
  request.releasedAt = nowIso();
  request.handledBy = actorId;
  request.handledAt = request.releasedAt;
  request.updatedAt = nowIso();
  addAudit(
    db,
    actorId,
    "Released internal requisition stock",
    "requisition",
    request.id,
    before,
    request,
  );
}

function receiveRequisition(
  db: Database,
  actorId: string,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  const requestId = requireString(payload?.requestId, "Requisition");
  const request = db.requisitions.find((item) => item.id === requestId);
  if (!request || request.status !== "released")
    throw new Error("Released requisition not found");
  if (!canWriteBranch(actor, request.requestingBranchId, getPrimaryAdminId(db)))
    throw new Error("You need branch posting access to receive this request");
  const before = {
    ...request,
    items: request.items.map((item) => ({ ...item })),
  };
  const receiveInputs = Array.isArray(payload?.items)
    ? (payload.items as Record<string, unknown>[])
    : [];
  const receiveByItem = new Map(
    receiveInputs.map((input) => [
      requireString(input.itemId ?? input.id, "Requisition item"),
      Math.max(0, requireNumber(input.quantity, "Received quantity")),
    ]),
  );
  const receiptEntries = [];
  let totalReceived = 0;
  const reference = `Requisition ${request.id}`;
  for (const item of request.items) {
    const releasedQuantity =
      item.releasedQuantity ?? item.fulfilledQuantity ?? 0;
    const receivedQuantity = receiveByItem.has(item.id)
      ? (receiveByItem.get(item.id) ?? 0)
      : releasedQuantity;
    if (receivedQuantity > releasedQuantity)
      throw new Error("Received quantity cannot exceed released quantity");
    item.receivedQuantity = receivedQuantity;
    if (receivedQuantity <= 0) continue;
    const destinationBatchId = item.destinationBatchId;
    if (
      !destinationBatchId ||
      !db.batches.some(
        (batch) =>
          batch.id === destinationBatchId &&
          batch.branchId === request.requestingBranchId,
      )
    ) {
      throw new Error(
        "Destination batch for this requisition item was not found",
      );
    }
    receiptEntries.push({
      id: id("led"),
      medicineId: item.medicineId,
      batchId: destinationBatchId,
      type: "stock-in" as LedgerType,
      quantity: receivedQuantity,
      reason: "Internal requisition received",
      reference,
      userId: actorId,
      createdAt: nowIso(),
      fromBranchId: request.sourceBranchId,
      toBranchId: request.requestingBranchId,
    });
    totalReceived += receivedQuantity;
  }
  if (totalReceived <= 0)
    throw new Error("Receive at least one released item quantity");
  db.ledger.unshift(...receiptEntries);
  request.status = "received";
  request.receivedBy = actorId;
  request.receivedAt = nowIso();
  request.updatedAt = nowIso();
  addAudit(
    db,
    actorId,
    "Received internal requisition stock",
    "requisition",
    request.id,
    before,
    request,
  );
}

function rejectRequisition(
  db: Database,
  actorId: string,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  const requestId = requireString(payload?.requestId, "Requisition");
  const request = db.requisitions.find((item) => item.id === requestId);
  if (!request || request.status !== "pending")
    throw new Error("Pending requisition not found");
  if (!canWriteBranch(actor, request.sourceBranchId, getPrimaryAdminId(db)))
    throw new Error("You need branch posting access to reject this request");
  const before = { ...request };
  request.status = "rejected";
  request.handledBy = actorId;
  request.handledAt = nowIso();
  request.updatedAt = nowIso();
  request.note = optionalString(payload?.note) || request.note;
  addAudit(
    db,
    actorId,
    "Rejected internal requisition",
    "requisition",
    request.id,
    before,
    request,
  );
}

function issueStock(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor || !canWrite({ ...actor, role: actorRole }))
    throw new Error("You do not have permission to issue stock");
  const medicineId = requireString(payload?.medicineId, "Medicine");
  const branchId =
    optionalString(payload?.branchId) ||
    db.branches.find((branch) => branch.active)?.id ||
    "main";
  if (!db.branches.some((branch) => branch.id === branchId && branch.active))
    throw new Error("Active branch not found");
  if (!canWriteBranch(actor, branchId, getPrimaryAdminId(db)))
    throw new Error("You only have view access in this branch");
  const quantity = requireNumber(payload?.quantity, "Quantity");
  if (quantity <= 0) throw new Error("Quantity must be greater than zero");
  const rows = db.batches
    .filter(
      (batch) => batch.branchId === branchId && batch.medicineId === medicineId,
    )
    .map((batch) => ({
      batch,
      quantity: db.ledger
        .filter((entry) => entry.batchId === batch.id)
        .reduce((sum, entry) => sum + entry.quantity, 0),
      daysToExpiry: daysUntil(batch.expiryDate),
    }))
    .filter((row) => row.quantity > 0 && row.daysToExpiry >= 0)
    .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate));
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  if (quantity > total)
    throw new Error(
      "Stock-out blocked: quantity exceeds available non-expired stock",
    );
  let remaining = quantity;
  const entries = [];
  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(row.quantity, remaining);
    entries.push({
      id: id("led"),
      medicineId,
      batchId: row.batch.id,
      type: "stock-out" as LedgerType,
      quantity: -take,
      reason: optionalString(payload?.reason) || "Dispense",
      reference: optionalString(payload?.reference) || "Manual issue",
      userId: actorId,
      createdAt: nowIso(),
    });
    remaining -= take;
  }
  db.ledger.unshift(...entries);
  addAudit(
    db,
    actorId,
    "Issued stock using FEFO",
    "ledger",
    entries[0]?.id ?? id("led"),
    undefined,
    entries,
  );
}

function canSellInBranch(db: Database, actor: User, branchId: string) {
  return (
    canAdmin(actor, getPrimaryAdminId(db)) ||
    canManageBranch(actor, branchId, getPrimaryAdminId(db)) ||
    ((actor.role === "pharmacist" || actor.role === "cashier") &&
      hasActiveBranchAssignment(actor, branchId))
  );
}

function canCompleteSaleInBranch(db: Database, actor: User, branchId: string) {
  const primaryAdminId = getPrimaryAdminId(db);
  return (
    canAdmin(actor, primaryAdminId) ||
    canManageBranch(actor, branchId, primaryAdminId) ||
    ((actor.role === "pharmacist" || actor.role === "cashier") &&
      hasActiveBranchAssignment(actor, branchId))
  );
}

function receiptReference() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `RXL-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function bookingCode() {
  return `BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function activeDraft(db: Database, userId: string, branchId: string) {
  const now = nowIso();
  db.posDrafts = db.posDrafts.filter((draft) => draft.expiresAt > now);
  return db.posDrafts.find(
    (draft) => draft.userId === userId && draft.branchId === branchId,
  );
}

function addDays(dateIso: string, days: number) {
  const date = new Date(dateIso);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeDraftItems(payload: unknown): PosDraft["items"] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      const input = item as Record<string, unknown>;
      const itemType: "medicine" | "product" =
        input.itemType === "product" ? "product" : "medicine";
      const daysSupply = Math.max(0, Number(input.daysSupply) || 0);
      return {
        itemType,
        itemId: requireString(
          input.itemId,
          itemType === "product" ? "Product" : "Medicine",
        ),
        quantity: requireNumber(input.quantity, "Quantity"),
        daysSupply: daysSupply || undefined,
        counselingNote: optionalString(input.counselingNote),
        labelInstruction: optionalString(input.labelInstruction),
      };
    })
    .filter((item) => item.quantity > 0);
}

function savePosDraft(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  const branchId = requireString(payload?.branchId, "Branch");
  if (!canSellInBranch(db, { ...actor, role: actorRole }, branchId))
    throw new Error("You do not have permission to use POS in this branch");
  const items = normalizeDraftItems(payload?.items);
  if (!items.length)
    throw new Error("Add at least one item to save the POS cart");
  const existing = activeDraft(db, actorId, branchId);
  const patient = patientForTransaction(db,actorId,branchId,payload,existing);
  const clinicalDraft = matchingPatientDraft(patient,payload,existing);
  const now = nowIso();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const draftDiscount = Math.max(0, Number(payload?.discount) || 0);
  const draft: PosDraft = {
    id: existing?.id || id("draft"),
    patientId: patient?.id,
    userId: actorId,
    branchId,
    bookingCode: existing?.bookingCode || bookingCode(),
    customerName:
      transactionText(payload,"customerName",existing?.customerName || ""),
    customerPhone:
      transactionText(payload,"customerPhone",existing?.customerPhone || ""),
    patientDetails: patientDetailsForSale(db, branchId, transactionText(payload,"customerPhone",existing?.customerPhone || ""), payload?.patientDetails, existing, patient?.id),
    patientInfoReliability: normalizePatientInfoReliability(
      payload?.patientInfoReliability || clinicalDraft?.patientInfoReliability,
    ),
    patientRiskContext: normalizePatientRiskContext(
      payload?.patientRiskContext || clinicalDraft?.patientRiskContext,
    ),
    paymentMethod: (optionalString(payload?.paymentMethod) ||
      existing?.paymentMethod ||
      "cash") as Sale["paymentMethod"],
    discount: draftDiscount,
    note: transactionText(payload,"note",clinicalDraft?.note || ""),
    followUpMessage:
      transactionText(payload,"followUpMessage",clinicalDraft?.followUpMessage || ""),
    pharmacistReviewOutcome: normalizePharmacistReviewOutcome(
      payload?.pharmacistReviewOutcome || clinicalDraft?.pharmacistReviewOutcome,
    ),
    pharmacistReviewNote:
      optionalString(payload?.pharmacistReviewNote) ||
      clinicalDraft?.pharmacistReviewNote ||
      "",
    safetyReviewSummary: normalizeSafetyReviewSummary(
      payload?.safetyReviewSummary || clinicalDraft?.safetyReviewSummary,
    ),
    items,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    expiresAt,
  };
  db.posDrafts = existing
    ? db.posDrafts.map((item) => (item.id === existing.id ? draft : item))
    : [draft, ...db.posDrafts];
  addAudit(
    db,
    actorId,
    "Saved POS draft cart",
    "pos-draft",
    draft.id,
    existing,
    draft,
  );
}

function clearPosDraft(
  db: Database,
  actorId: string,
  payload: Record<string, unknown> | undefined,
) {
  const branchId = requireString(payload?.branchId, "Branch");
  const actor = db.users.find(user => user.id === actorId);
  if (!actor || !canSellInBranch(db, actor, branchId))
    throw new Error("You do not have permission to delete drafts in this branch");
  const draftId = optionalString(payload?.draftId);
  const before = draftId
    ? db.posDrafts.find(
        (draft) => draft.id === draftId && draft.branchId === branchId,
      )
    : activeDraft(db, actorId, branchId);
  db.posDrafts = draftId
    ? db.posDrafts.filter((draft) => !(draft.id === draftId && draft.branchId === branchId))
    : db.posDrafts.filter(
        (draft) => !(draft.userId === actorId && draft.branchId === branchId),
      );
  if (before)
    addAudit(
      db,
      actorId,
      "Cleared POS draft cart",
      "pos-draft",
      before.id,
      before,
      undefined,
    );
}

function patientMatchesContinuityRequest(
  request: Database["continuityRequests"][number],
  sale: Sale,
) {
  if (request.patientId || sale.patientId) return Boolean(request.patientId && request.patientId === sale.patientId);
  const requestPhone = normalizePatientPhone(request.patientPhone);
  const salePhone = normalizePatientPhone(sale.customerPhone);
  if (requestPhone && salePhone) return requestPhone === salePhone;
  return (
    request.patientName.trim().toLowerCase() ===
      sale.customerName.trim().toLowerCase() &&
    request.patientName.trim().toLowerCase() !== "walk-in patient"
  );
}

function fulfillContinuityRequestsFromSale(
  db: Database,
  actorId: string,
  sale: Sale,
) {
  const soldMedicineIds = new Set(
    sale.items
      .filter((item) => item.itemType === "medicine" && item.quantity > 0)
      .map((item) => item.medicineId)
      .filter(Boolean),
  );
  if (!soldMedicineIds.size) return;
  const fulfilled: Database["continuityRequests"] = [];
  db.continuityRequests.forEach((request) => {
    if (request.status === "fulfilled" || request.status === "cancelled")
      return;
    if (request.originBranchId !== sale.branchId) return;
    if (!soldMedicineIds.has(request.medicineId)) return;
    if (!patientMatchesContinuityRequest(request, sale)) return;
    const before = { ...request };
    request.status = "fulfilled";
    request.fulfilledAt = sale.soldAt;
    request.closedAt = sale.soldAt;
    request.updatedAt = sale.soldAt;
    request.resolvedBy = actorId;
    fulfilled.push({ ...request });
    addAudit(
      db,
      actorId,
      "Fulfilled continuity request from POS sale",
      "continuity-request",
      request.id,
      before,
      { ...request, saleId: sale.id, saleReference: sale.reference },
    );
  });
  if (fulfilled.length) {
    addAudit(
      db,
      actorId,
      `Closed ${fulfilled.length} continuity request${fulfilled.length === 1 ? "" : "s"} after POS sale`,
      "sale",
      sale.id,
      undefined,
      fulfilled,
    );
  }
}

/** Canonical JSON makes object-key order irrelevant, while preserving cart order. */
function checkoutFingerprint(payload: Record<string, unknown>) {
  const canonical = (value: unknown): unknown => Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]))
      : value;
  const {operationId: _operationId, ...request} = payload;
  void _operationId;
  return createHash("sha256").update(JSON.stringify(canonical(request))).digest("hex");
}

function checkoutContext(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find(user => user.id === actorId);
  const branchId = requireString(payload?.branchId, "Branch");
  if (!actor || !db.branches.some(branch => branch.id === branchId && branch.active) ||
      !canCompleteSaleInBranch(db, {...actor, role: actorRole}, branchId))
    throw new Error("You do not have permission to confirm this checkout");
  const operationId = requireString(payload?.operationId, "Checkout operation ID. Refresh POS");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId))
    throw new Error("Invalid checkout operation ID. Refresh POS before continuing.");
  return {actor, branchId, operationId: operationId.toLowerCase()};
}

function checkoutStatus(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined): CheckoutResult {
  const {branchId, operationId} = checkoutContext(db, actorId, actorRole, payload);
  const sale = db.sales.find(item => item.checkoutOperationId === operationId);
  const cancelled = db.cancelledCheckouts?.find(item => item.operationId === operationId);
  if ((sale && (sale.cashierUserId !== actorId || sale.branchId !== branchId)) ||
      (cancelled && (cancelled.userId !== actorId || cancelled.branchId !== branchId)))
    throw new Error("Checkout not found or not permitted");
  if (sale) return {state: "confirmed", sale, replayed: true};
  return {state: cancelled ? "cancelled" : "not_found", replayed: Boolean(cancelled)};
}

function completedCheckout(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined): CheckoutResult | undefined {
  const result = checkoutStatus(db, actorId, actorRole, payload);
  if (result.state === "confirmed" && result.sale?.checkoutFingerprint !== checkoutFingerprint(payload!))
    throw Object.assign(new Error("This checkout ID belongs to a different cart. Recover its original receipt before starting another sale."), {name: "CheckoutMismatchError"});
  return result.state === "not_found" ? undefined : result;
}

function cancelCheckout(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined): CheckoutResult {
  const result = checkoutStatus(db, actorId, actorRole, payload);
  if (result.state !== "not_found") return result;
  const {branchId, operationId} = checkoutContext(db, actorId, actorRole, payload);
  const cancelled = {operationId, branchId, userId: actorId, cancelledAt: nowIso()};
  db.cancelledCheckouts = [...(db.cancelledCheckouts || []), cancelled];
  addAudit(db, actorId, "Cancelled unconfirmed checkout", "checkout", operationId, undefined, cancelled);
  return {state: "cancelled"};
}

function recordSale(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  const branchId =
    optionalString(payload?.branchId) ||
    db.branches.find((branch) => branch.active)?.id ||
    "main";
  if (!db.branches.some((branch) => branch.id === branchId && branch.active))
    throw new Error("Active branch not found");
  if (!canSellInBranch(db, { ...actor, role: actorRole }, branchId))
    throw new Error("You do not have permission to sell in this branch");
  if (!canCompleteSaleInBranch(db, { ...actor, role: actorRole }, branchId))
    throw new Error("Only authorized branch staff can complete POS sales");
  const existingCheckout = completedCheckout(db, actorId, actorRole, payload);
  if (existingCheckout?.state === "confirmed") return existingCheckout;
  if (existingCheckout?.state === "cancelled") throw new Error("This checkout was cancelled. Start a new sale.");
  const {operationId} = checkoutContext(db, actorId, actorRole, payload);
  const fingerprint = checkoutFingerprint(payload!);
  const requestedDraftId = optionalString(payload?.draftId);
  const draft = requestedDraftId
    ? db.posDrafts.find(
        (item) =>
          item.id === requestedDraftId &&
          item.branchId === branchId &&
          item.expiresAt > nowIso(),
      )
    : activeDraft(db, actorId, branchId);
  if (requestedDraftId && !draft)
    throw new Error("This draft is expired, already completed or unavailable. Refresh POS before continuing.");
  const inputs = normalizeDraftItems(payload?.items ?? draft?.items);
  if (!inputs.length) throw new Error("Add at least one item to the POS cart");

  const patient = patientForTransaction(db,actorId,branchId,payload,draft);
  const clinicalDraft = matchingPatientDraft(patient,payload,draft);
  const saleItems: Sale["items"] = [];
  const ledgerEntries: Database["ledger"] = [];
  for (const input of inputs) {
    const quantity = requireNumber(input.quantity, "Quantity");
    if (quantity <= 0) throw new Error("Quantity must be greater than zero");
    if (input.itemType === "product") {
      const product = db.products.find(
        (item) => item.id === input.itemId && item.active,
      );
      if (!product) throw new Error("Active product not found");
      const pendingQuantity = ledgerEntries.reduce((total, entry) => entry.itemType === "product" && entry.productId === product.id ? total + entry.quantity : total, 0);
      if (quantity > productQuantityInBranches(db, product.id, [branchId]) + pendingQuantity)
        throw new Error(`${product.name} does not have enough stock`);
      if (product.sellingPrice <= 0)
        throw new Error(
          `${product.name} needs a selling price before it can be sold`,
        );
      product.quantity -= quantity;
      saleItems.push({
        itemType: "product",
        medicineId: "",
        productId: product.id,
        itemName: product.name,
        quantity,
        unitPrice: product.sellingPrice,
        lineTotal: quantity * product.sellingPrice,
        daysSupply: input.daysSupply,
        counselingNote: input.counselingNote,
        labelInstruction: input.labelInstruction,
      });
      ledgerEntries.push({
        id: id("led"),
        itemType: "product" as const,
        medicineId: "",
        productId: product.id,
        batchId: "",
        unitCost: product.costPrice,
        sellingPrice: product.sellingPrice,
        type: "stock-out" as LedgerType,
        quantity: -quantity,
        reason: "POS sale",
        reference: optionalString(payload?.reference) || "POS sale",
        userId: actorId,
        createdAt: nowIso(),
        fromBranchId: branchId,
      });
      continue;
    }
    const medicineId = input.itemId;
    const medicine = db.medicines.find(
      (item) => item.id === medicineId && item.active,
    );
    if (!medicine) throw new Error("Active medicine not found");
    const rows = db.batches
      .filter(
        (batch) =>
          batch.branchId === branchId && batch.medicineId === medicineId,
      )
      .map((batch) => ({
        batch,
        quantity: getBatchAvailable(db, batch.id) + ledgerEntries.reduce(
          (sum, entry) => entry.itemType === "medicine" && entry.batchId === batch.id ? sum + entry.quantity : sum, 0,
        ),
        daysToExpiry: daysUntil(batch.expiryDate),
      }))
      .filter((row) => row.quantity > 0 && row.daysToExpiry >= 0)
      .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate));
    const total = rows.reduce((sum, row) => sum + row.quantity, 0);
    if (quantity > total)
      throw new Error(
        `${medicine.brandName} does not have enough non-expired stock in this branch`,
      );
    let remaining = quantity;
    for (const row of rows) {
      if (remaining <= 0) break;
      const take = Math.min(row.quantity, remaining);
      const unitPrice = medicine.sellingPrice || row.batch.sellingPrice;
      if (unitPrice <= 0)
        throw new Error(
          `${medicine.brandName} needs a selling price before it can be sold`,
        );
      const lineTotal = take * unitPrice;
      saleItems.push({
        itemType: "medicine",
        medicineId,
        batchId: row.batch.id,
        itemName: medicine.brandName,
        quantity: take,
        unitPrice,
        lineTotal,
        daysSupply: input.daysSupply,
        refillDueAt: input.daysSupply
          ? addDays(nowIso(), input.daysSupply)
          : undefined,
        counselingNote: input.counselingNote,
        labelInstruction: input.labelInstruction,
      });
      ledgerEntries.push({
        id: id("led"),
        itemType: "medicine" as const,
        medicineId,
        batchId: row.batch.id,
        type: "stock-out" as LedgerType,
        quantity: -take,
        reason: "POS sale",
        reference: optionalString(payload?.reference) || "POS sale",
        userId: actorId,
        createdAt: nowIso(),
      });
      remaining -= take;
    }
  }
  const subtotal = saleItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const requestedDiscount = Math.min(
    Math.max(0, Number(payload?.discount ?? draft?.discount) || 0),
    subtotal,
  );
  const maxDiscount =
    subtotal * (discountLimitPercent(db, { ...actor, role: actorRole }) / 100);
  if (requestedDiscount > maxDiscount) {
    throw new Error(
      `Discount exceeds your ${discountLimitPercent(db, { ...actor, role: actorRole })}% limit`,
    );
  }
  const discount = requestedDiscount;
  const reference = receiptReference();
  ledgerEntries.forEach((entry) => {
    if (entry.reason === "POS sale") entry.reference = reference;
  });

  const sale: Sale = {
    id: id("sale"),
    checkoutOperationId: operationId,
    patientId: patient?.id,
    checkoutFingerprint: fingerprint,
    branchId,
    cashierUserId: actorId,
    customerName:
      transactionText(payload,"customerName",draft?.customerName || ""),
    customerPhone:
      transactionText(payload,"customerPhone",draft?.customerPhone || ""),
    patientDetails: patientDetailsForSale(db, branchId, transactionText(payload,"customerPhone",draft?.customerPhone || ""), payload?.patientDetails, draft, patient?.id),
    patientInfoReliability: normalizePatientInfoReliability(
      payload?.patientInfoReliability || clinicalDraft?.patientInfoReliability,
    ),
    patientRiskContext: normalizePatientRiskContext(
      payload?.patientRiskContext || clinicalDraft?.patientRiskContext,
    ),
    paymentMethod: (optionalString(payload?.paymentMethod) ||
      draft?.paymentMethod ||
      "cash") as Sale["paymentMethod"],
    reference,
    note: transactionText(payload,"note",clinicalDraft?.note || ""),
    followUpMessage:
      transactionText(payload,"followUpMessage",clinicalDraft?.followUpMessage || ""),
    pharmacistReviewOutcome: normalizePharmacistReviewOutcome(
      payload?.pharmacistReviewOutcome || clinicalDraft?.pharmacistReviewOutcome,
    ),
    pharmacistReviewNote:
      optionalString(payload?.pharmacistReviewNote) ||
      clinicalDraft?.pharmacistReviewNote ||
      "",
    safetyReviewSummary: normalizeSafetyReviewSummary(
      payload?.safetyReviewSummary || clinicalDraft?.safetyReviewSummary,
    ),
    soldAt: nowIso(),
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    bookingCode: draft?.bookingCode,
    items: saleItems,
  };
  db.ledger.unshift(...ledgerEntries);
  db.sales.unshift(sale);
  fulfillContinuityRequestsFromSale(db, actorId, sale);
  db.posDrafts = db.posDrafts.filter((item) => item.id !== draft?.id);
  addAudit(db, actorId, "Completed POS sale", "sale", sale.id, undefined, sale);
  return {state: "confirmed" as const, sale, replayed: false};
}

function updateSellingPrice(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  const medicineId = requireString(payload?.medicineId, "Medicine");
  const branchId = requireString(payload?.branchId, "Branch");
  const priceManager = canManageMedicinePrices(db, actor, actorRole, branchId);
  if (!priceManager)
    throw new Error("You do not have permission to update selling prices");
  const sellingPrice = requireNumber(payload?.sellingPrice, "Selling price");
  const costPrice = Number(payload?.costPrice);
  const overrideReason = optionalString(payload?.overrideReason);
  if (
    pricingPolicy(db.settings).enabled &&
    (!canAdmin(actor, getPrimaryAdminId(db)) || !overrideReason)
  ) {
    throw new Error(
      "Auto pricing is enabled. Only the permanent admin can override a selling price, and a reason is required.",
    );
  }
  if (sellingPrice < 0) throw new Error("Selling price cannot be negative");
  if (
    !canAdmin(actor, getPrimaryAdminId(db)) &&
    !hasActiveBranchAssignment(actor, branchId)
  )
    throw new Error("You do not have access to this branch");
  const medicine = db.medicines.find((item) => item.id === medicineId);
  if (!medicine) throw new Error("Medicine not found");
  const nextCostPrice = Number.isFinite(costPrice)
    ? Math.max(0, costPrice)
    : medicine.costPrice;
  if (sellingPrice > 0 && sellingPrice < nextCostPrice)
    throw new Error(
      "Selling price must be equal to or greater than cost price",
    );
  const beforeMedicine = { ...medicine };
  medicine.costPrice = nextCostPrice;
  medicine.sellingPrice = sellingPrice;
  const batches = db.batches.filter(
    (batch) =>
      batch.branchId === branchId &&
      batch.medicineId === medicineId &&
      getBatchAvailable(db, batch.id) > 0,
  );
  const before = batches.map((batch) => ({
    id: batch.id,
    sellingPrice: batch.sellingPrice,
  }));
  batches.forEach((batch) => {
    batch.sellingPrice = sellingPrice;
    if (nextCostPrice > 0) batch.unitCost = nextCostPrice;
  });
  addAudit(
    db,
    actorId,
    `Updated pricing for ${medicine.brandName}${overrideReason ? ` / Override: ${overrideReason}` : ""}`,
    "medicine",
    medicineId,
    { medicine: beforeMedicine, batches: before },
    {
      branchId,
      costPrice: nextCostPrice,
      sellingPrice,
      overrideReason: overrideReason || undefined,
    },
  );
}

function adjustStock(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor || !canAdjust({ ...actor, role: actorRole }))
    throw new Error("You do not have permission to adjust stock");
  const batchId = requireString(payload?.batchId, "Batch");
  const batch = db.batches.find((item) => item.id === batchId);
  if (!batch) throw new Error("Batch not found");
  if (!canWriteBranch(actor, batch.branchId, getPrimaryAdminId(db)))
    throw new Error("You only have view access in this branch");
  const mode = requireString(payload?.mode, "Transaction type") as LedgerType;
  const quantity = requireNumber(payload?.quantity, "Quantity");
  if (quantity <= 0) throw new Error("Quantity must be greater than zero");
  if (!["adjustment", "customer-return", "write-off", "supplier-return"].includes(mode))
    throw new Error("Unsupported adjustment type");
  const current = db.ledger
    .filter((entry) => entry.batchId === batchId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const isPositive = mode === "adjustment" || mode === "customer-return";
  if (!isPositive && quantity > current)
    throw new Error(
      "Adjustment blocked: cannot reduce more than available stock",
    );
  const entry = {
    id: id("led"),
    medicineId: batch.medicineId,
    batchId,
    type: mode,
    quantity: isPositive ? quantity : -quantity,
    reason: requireString(payload?.reason, "Reason"),
    reference: optionalString(payload?.reference) || mode,
    userId: actorId,
    createdAt: nowIso(),
  };
  db.ledger.unshift(entry);
  addAudit(db, actorId, `Posted ${mode}`, "ledger", entry.id, undefined, entry);
}

function updateSettings(
  db: Database,
  actorId: string,
  actorRole: Role,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor || !canAdmin({ ...actor, role: actorRole }, getPrimaryAdminId(db)))
    throw new Error("Only the permanent admin can update settings");
  const before = { ...db.settings };
  const currentPlanId = db.settings.subscriptionPlanId ?? "smart-pharmacy";
  const subscriptionPlanId = normalizeSubscriptionPlanId(
    payload?.subscriptionPlanId,
    currentPlanId,
  );
  const blockers =
    subscriptionPlanId === currentPlanId
      ? []
      : subscriptionPlanBlockers(db, subscriptionPlanId);
  if (blockers.length) {
    throw new Error(
      `${blockers.join(" ")} No historical stock, sales, patient, branch, or audit data will be deleted; archive or deactivate extra usage before downgrading.`,
    );
  }
  const roundingIncrement = Number(payload?.pricingRoundingRule ?? db.settings.pricingRoundingRule ?? 10);
  if (!Number.isFinite(roundingIncrement) || roundingIncrement < 0 ||
      (roundingIncrement > 0 && roundingIncrement < 0.01)) {
    throw new Error("Rounding increment must be zero or at least NGN 0.01");
  }
  db.settings = {
    pharmacyName:
      optionalString(payload?.pharmacyName) || db.settings.pharmacyName,
    softwareName: db.settings.softwareName,
    accountName:
      optionalString(payload?.accountName) || db.settings.accountName,
    branchName: optionalString(payload?.branchName) || db.settings.branchName,
    companySlug: db.settings.companySlug,
    companyCode: db.settings.companyCode,
    businessLicense:
      optionalString(payload?.businessLicense) || db.settings.businessLicense,
    mainBranchAddress:
      optionalString(payload?.mainBranchAddress) ||
      db.settings.mainBranchAddress,
    logoDataUrl: optionalString(payload?.logoDataUrl),
    primaryAdminId: db.settings.primaryAdminId || actorId,
    nearExpiryDays:
      Number(payload?.nearExpiryDays) || db.settings.nearExpiryDays,
    approvalThreshold:
      Number(payload?.approvalThreshold) || db.settings.approvalThreshold,
    autoPricingEnabled: Boolean(payload?.autoPricingEnabled),
    globalMarkupPercent: Math.max(0, Number(payload?.globalMarkupPercent) || 0),
    pricingRoundingRule: roundingIncrement,
    categoryMarkupPercentages: normalizeMarkupMap(
      payload?.categoryMarkupPercentages,
    ),
    productMarkupPercentages: normalizeMarkupMap(
      payload?.productMarkupPercentages,
    ),
    cashierDiscountLimitPercent: Math.max(
      0,
      Math.min(100, Number(payload?.cashierDiscountLimitPercent ?? 5) || 0),
    ),
    managerDiscountLimitPercent: Math.max(
      0,
      Math.min(100, Number(payload?.managerDiscountLimitPercent ?? 10) || 0),
    ),
    unusualMarkupPercent: Math.max(
      0,
      Number(payload?.unusualMarkupPercent ?? 80) || 0,
    ),
    costChangeWarningPercent: Math.max(
      0,
      Number(payload?.costChangeWarningPercent ?? 30) || 0,
    ),
    defaultFollowUpLabel:
      optionalString(payload?.defaultFollowUpLabel) || "Follow-up",
    defaultFollowUpMessage: optionalString(payload?.defaultFollowUpMessage),
    dosageFormLabelRules: normalizeStringMap(payload?.dosageFormLabelRules),
    medicineLabelRules: normalizeMedicineLabelRules(
      payload?.medicineLabelRules,
    ),
    subscriptionPlanId,
    trialStartedAt: db.settings.trialStartedAt,
    trialEndsAt: db.settings.trialEndsAt,
  };
  addAudit(
    db,
    actorId,
    "Updated system settings",
    "settings",
    "main",
    before,
    db.settings,
  );
}

function sendChatMessage(
  db: Database,
  actorId: string,
  payload: Record<string, unknown> | undefined,
) {
  const actor = db.users.find(user => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  const branchId = requireString(payload?.branchId, "Branch");
  if (!db.branches.some(branch => branch.id === branchId && branch.active) ||
      (!canAdmin(actor, getPrimaryAdminId(db)) && !hasActiveBranchAssignment(actor, branchId)))
    throw new Error("You do not have access to this message branch");
  const body = requireString(payload?.body, "Message");
  if (body.length > 2000) throw new Error("Message is too long");
  const channel: "group" | "direct" =
    optionalString(payload?.channel) === "direct" ? "direct" : "group";
  const recipientUserId =
    channel === "direct"
      ? requireString(payload?.recipientUserId, "Recipient")
      : "";
  if (channel === "direct") {
    if (recipientUserId === actorId)
      throw new Error("Choose another employee for a direct message");
    const recipient = db.users.find(
      (user) => user.id === recipientUserId && user.status === "active",
    );
    if (!recipient) throw new Error("Recipient not found or inactive");
    if (!canAdmin(recipient, getPrimaryAdminId(db)) && !hasActiveBranchAssignment(recipient, branchId))
      throw new Error("Recipient does not have access to this branch");
    if (!scopeDatabaseForUser(db, actor).users.some(user => user.id === recipientUserId))
      throw new Error("Recipient is outside your branch access");
  }
  const message = {
    id: id("msg"),
    userId: actorId,
    branchId,
    channel,
    recipientUserId,
    body,
    createdAt: nowIso(),
  };
  db.chatMessages.unshift(message);
  markChatRead(db, actorId, { branchId });
}

function markChatRead(db: Database, actorId: string, payload?: Record<string, unknown>) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) throw new Error("Authentication required");
  const branchId = optionalString(payload?.branchId);
  if (!branchId) {
    if (!canAdmin(actor, getPrimaryAdminId(db))) throw new Error("Branch is required");
    actor.lastChatSeenAt = nowIso();
    return;
  }
  if (!db.branches.some(branch => branch.id === branchId && branch.active) ||
      (!canAdmin(actor, getPrimaryAdminId(db)) && !hasActiveBranchAssignment(actor, branchId)))
    throw new Error("You do not have access to this message branch");
  actor.lastChatSeenAtByBranch = { ...actor.lastChatSeenAtByBranch, [branchId]: nowIso() };
}
