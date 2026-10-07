import { createHash, timingSafeEqual } from "node:crypto";
import {
  daysUntil,
  fail,
  getBearerToken,
  requireMethod,
  resolveTenantWorkspace,
} from "../_shared.js";
import { resolveRaiAccessScope, type RaiCapability } from "./access-policy.js";
import { getDelegationService } from "./connection.js";
import { assertGrantScope } from "./delegation.js";
import type {
  Database,
  HandlerRequest,
  HandlerResponse,
  Medicine,
  Product,
  Sale,
} from "../_shared.js";

type SnapshotBody = {
  tenant_id?: unknown;
  actor_id?: unknown;
  branch_ids?: unknown;
  capabilities?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  timezone?: unknown;
  include_voided?: unknown;
  include_returns?: unknown;
};

type RaiMedication = {
  medication_id: string;
  medication_name: string;
  strength: string;
  category: string;
  unit: string;
  current_stock: number;
  average_monthly_usage: number;
  cost_per_unit: number;
  selling_price_per_unit: number;
  pending_owed_quantity: number;
  supplier_lead_time_days: number;
  expiry_risk_quantity: number;
  days_until_stockout: number;
  days_since_last_sale: number;
  stock_value: number;
};

type RaiDispenseRecord = {
  transaction_id: string;
  patient_id: string;
  medication_id: string;
  quantity_dispensed: number;
  branch_id: string;
  dispensed_at: string;
  voided: boolean;
  returned: boolean;
};

export default async function handler(
  req: HandlerRequest,
  res: HandlerResponse,
) {
  if (!requireMethod(req, res, ["POST"])) return;
  res.setHeader("Cache-Control", "no-store");

  try {
    if (!isAuthorized(req)) {
      fail(res, 401, "Unauthorized");
      return;
    }
    const delegatedToken = req.headers["x-rai-delegated-token"];
    if (typeof delegatedToken !== "string" || !delegatedToken) {
      fail(res, 401, "A delegated Rai grant is required");
      return;
    }

    const body = parseBody(req.body);
    const tenantLookup = requireText(body.tenant_id, "tenant_id");
    const startDate = validDate(body.start_date);
    const endDate = validDate(body.end_date);
    if (!startDate || !endDate || Date.parse(endDate) - Date.parse(startDate) > 365 * 86400000) throw new TypeError("Valid start_date and end_date spanning at most 366 days are required");
    if (body.timezone !== "Africa/Lagos" || body.include_voided === true || body.include_returns === true) throw new TypeError("Unsupported timezone or transaction filters");
    if (startDate > endDate) {
      fail(res, 400, "start_date cannot be after end_date");
      return;
    }

    const actorId = requireText(body.actor_id, "actor_id");
    const tenant = await resolveTenantWorkspace(tenantLookup);
    if (!tenant) {
      fail(res, 404, "Tenant not found");
      return;
    }

    const db = tenant.db;
    const grant = await getDelegationService().inspect(delegatedToken);
    const actor = db.users.find(user => user.id === grant.userId);
    if (!actor || actor.id !== actorId) {
      fail(res, 403, "Rai access is not available for this user");
      return;
    }
    const branchScope = resolveBranchScope(db, body.branch_ids);
    const capabilities = parseCapabilities(body.capabilities);
    assertGrantScope(grant, { tenantId: tenant.slug, userId: actorId, branchIds: branchScope.branchIds, capabilities });
    const access = resolveRaiAccessScope({ db, user: actor, requestedBranchIds: branchScope.branchIds, requiredCapabilities: capabilities });
    if (!access.ok) {
      fail(res, 403, access.reason);
      return;
    }
    const medications = buildMedications(db, access.branchIds, startDate, endDate).map((item) => redactMedication(item, access.capabilities));
    const dispenseRecords = access.capabilities.includes("continuity_analytics")
      ? buildDispenseRecords(db, access.branchIds, startDate, endDate)
      : [];

    res.status(200).json({
      data: {
        medications,
        continuity_summary: access.capabilities.includes("continuity_analytics") ? { dispense_line_count: dispenseRecords.length } : undefined,
      },
      meta: {
        source: "rxledger",
        generated_at: new Date().toISOString(),
        tenant_id: tenant.slug,
        branch_ids: access.branchIds,
        date_range: {
          start_date: startDate,
          end_date: endDate,
        },
        timezone: text(body.timezone) || "Africa/Lagos",
        filters: {
          include_voided: false,
          include_returns: false,
          capabilities: access.capabilities,
        },
        warnings: [...branchScope.warnings, "Snapshot supports inventory and demand inputs only; historical revenue, realised profit and unique-patient counts are unavailable."],
      },
    });
  } catch (error) {
    fail(
      res,
      error instanceof TypeError ? 400 : Number((error as { status?: number }).status) || 500,
      error instanceof TypeError ? error.message : "Unable to create Rai analytics snapshot",
    );
  }
}

function parseCapabilities(value: unknown): RaiCapability[] {
  const allowed: RaiCapability[] = ["inventory_analytics", "sales_analytics", "financial_analytics", "continuity_analytics"];
  const values = Array.isArray(value) ? value.map(text).filter(Boolean) : [];
  if (!values.length || values.length !== (value as unknown[]).length || values.some(item => !allowed.includes(item as RaiCapability))) throw new TypeError("Explicit supported capabilities are required");
  return Array.from(new Set(values)) as RaiCapability[];
}

function redactMedication(item: RaiMedication, capabilities: RaiCapability[]): Partial<RaiMedication> {
  const result: Partial<RaiMedication> = { medication_id: item.medication_id, medication_name: item.medication_name, strength: item.strength, category: item.category, unit: item.unit };
  if (capabilities.includes("inventory_analytics")) Object.assign(result, { current_stock: item.current_stock, expiry_risk_quantity: item.expiry_risk_quantity, days_until_stockout: item.days_until_stockout, average_monthly_usage: item.average_monthly_usage, days_since_last_sale: item.days_since_last_sale });
  if (capabilities.includes("sales_analytics")) Object.assign(result, { average_monthly_usage: item.average_monthly_usage, days_since_last_sale: item.days_since_last_sale });
  if (capabilities.includes("continuity_analytics")) result.pending_owed_quantity = item.pending_owed_quantity;
  if (capabilities.includes("financial_analytics")) Object.assign(result, { cost_per_unit: item.cost_per_unit, selling_price_per_unit: item.selling_price_per_unit, stock_value: item.stock_value });
  return result;
}

function isAuthorized(req: HandlerRequest) {
  const expected =
    process.env.RXLEDGER_RAI_API_KEY ||
    process.env.RAI_API_KEY ||
    process.env.RXLEDGER_API_KEY;
  if (!expected) return false;

  const token = getBearerToken(req);
  if (!token) return false;

  const actualBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function parseBody(body: unknown): SnapshotBody {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as SnapshotBody;
  }
  if (typeof body === "string" && body.trim()) {
    return JSON.parse(body) as SnapshotBody;
  }
  return {};
}

function resolveBranchScope(db: Database, value: unknown): { branchIds: string[]; warnings: string[] } {
  const requested = Array.isArray(value)
    ? value.map((item) => text(item)).filter(Boolean)
    : [];
  const activeBranches = db.branches.filter((branch) => branch.active);

  if (!requested.length || requested.length > 20 || requested.length !== (value as unknown[]).length) throw new TypeError("Explicit branch ids are required (maximum 20)");

  const warnings: string[] = [];
  const branchIds = requested.map((branchLookup) => {
    const match = activeBranches.find((branch) => branch.id === branchLookup);
    if (!match) {
      throw new TypeError("Unknown or inactive branch");
    }
    return match.id;
  });

  return {
    branchIds: Array.from(new Set(branchIds)),
    warnings,
  };
}

function buildMedications(
  db: Database,
  branchIds: string[],
  startDate: string,
  endDate: string,
): RaiMedication[] {
  return [
    ...db.medicines.filter((item) => item.active !== false).map((medicine) =>
      mapMedicine(db, medicine, branchIds, startDate, endDate),
    ),
    ...db.products.filter((item) => item.active !== false).map((product) =>
      mapProduct(db, product, branchIds, startDate, endDate),
    ),
  ];
}

function mapMedicine(
  db: Database,
  medicine: Medicine,
  branchIds: string[],
  startDate: string,
  endDate: string,
): RaiMedication {
  const soldRows = medicineSalesRows(db, medicine.id, branchIds, startDate, endDate);
  const quantitySold = sum(soldRows.map((row) => row.quantity));
  const currentStock = currentMedicineStock(db, medicine.id, branchIds);
  const averageMonthlyUsage = monthlyUsage(quantitySold, startDate, endDate);
  const daysSinceLastSale = daysSinceLatestSale(soldRows.map((row) => row.soldAt));
  const expiryRiskQuantity = expiringMedicineStock(db, medicine.id, branchIds);
  const pendingOwedQuantity = db.continuityRequests
    .filter(
      (request) =>
        request.medicineId === medicine.id &&
        ["open", "matched", "contacted", "transferred"].includes(request.status) &&
        branchIds.includes(request.originBranchId),
    )
    .reduce((total, request) => total + request.quantityRequested, 0);

  return {
    medication_id: medicine.id,
    medication_name: medicine.brandName,
    strength: medicine.strength,
    category: medicine.category,
    unit: medicine.sellableUnit || medicine.unit,
    current_stock: currentStock,
    average_monthly_usage: averageMonthlyUsage,
    cost_per_unit: medicine.costPrice,
    selling_price_per_unit: medicine.sellingPrice,
    pending_owed_quantity: pendingOwedQuantity,
    supplier_lead_time_days: 7,
    expiry_risk_quantity: expiryRiskQuantity,
    days_until_stockout: daysUntilStockout(currentStock, averageMonthlyUsage),
    days_since_last_sale: daysSinceLastSale,
    stock_value: currentStock * medicine.costPrice,
  };
}

function mapProduct(
  db: Database,
  product: Product,
  branchIds: string[],
  startDate: string,
  endDate: string,
): RaiMedication {
  const soldRows = productSalesRows(db, product.id, branchIds, startDate, endDate);
  const quantitySold = sum(soldRows.map((row) => row.quantity));
  const currentStock = currentProductStock(db, product.id, branchIds);
  const averageMonthlyUsage = monthlyUsage(quantitySold, startDate, endDate);

  return {
    medication_id: product.id,
    medication_name: product.name,
    strength: "",
    category: product.category,
    unit: product.unit,
    current_stock: currentStock,
    average_monthly_usage: averageMonthlyUsage,
    cost_per_unit: product.costPrice,
    selling_price_per_unit: product.sellingPrice,
    pending_owed_quantity: 0,
    supplier_lead_time_days: 7,
    expiry_risk_quantity: 0,
    days_until_stockout: daysUntilStockout(currentStock, averageMonthlyUsage),
    days_since_last_sale: daysSinceLatestSale(soldRows.map((row) => row.soldAt)),
    stock_value: currentStock * product.costPrice,
  };
}

function buildDispenseRecords(
  db: Database,
  branchIds: string[],
  startDate: string,
  endDate: string,
): RaiDispenseRecord[] {
  return db.sales
    .filter((sale) => branchIds.includes(sale.branchId) && saleDate(sale) >= startDate && saleDate(sale) <= endDate)
    .flatMap((sale) =>
      sale.items.map((item, index): RaiDispenseRecord => ({
        transaction_id: `${sale.id}:${index}`,
        patient_id: stablePatientId(sale),
        medication_id: item.itemType === "product" ? item.productId || item.medicineId : item.medicineId,
        quantity_dispensed: item.quantity,
        branch_id: sale.branchId,
        dispensed_at: saleDate(sale),
        voided: false,
        returned: false,
      })),
    );
}

function currentMedicineStock(db: Database, medicineId: string, branchIds: string[]) {
  return db.batches
    .filter((batch) => branchIds.includes(batch.branchId) && batch.medicineId === medicineId)
    .reduce((total, batch) => {
      if (daysUntil(batch.expiryDate) < 0) return total;
      return total + Math.max(0, ledgerQuantity(db, batch.id));
    }, 0);
}

function currentProductStock(db: Database, productId: string, branchIds: string[]) {
  return db.ledger
    .filter((entry) => entry.productId === productId && branchIds.includes(entry.toBranchId || entry.fromBranchId || ""))
    .reduce((total, entry) => total + entry.quantity, 0);
}

function expiringMedicineStock(db: Database, medicineId: string, branchIds: string[]) {
  return db.batches
    .filter(
      (batch) =>
        branchIds.includes(batch.branchId) &&
        batch.medicineId === medicineId &&
        daysUntil(batch.expiryDate) >= 0 &&
        daysUntil(batch.expiryDate) <= db.settings.nearExpiryDays,
    )
    .reduce((total, batch) => total + Math.max(0, ledgerQuantity(db, batch.id)), 0);
}

function ledgerQuantity(db: Database, batchId: string) {
  return db.ledger
    .filter((entry) => entry.batchId === batchId)
    .reduce((total, entry) => total + entry.quantity, 0);
}

function medicineSalesRows(
  db: Database,
  medicineId: string,
  branchIds: string[],
  startDate: string,
  endDate: string,
) {
  return db.sales
    .filter((sale) => branchIds.includes(sale.branchId) && saleDate(sale) >= startDate && saleDate(sale) <= endDate)
    .flatMap((sale) =>
      sale.items
        .filter((item) => item.itemType !== "product" && item.medicineId === medicineId)
        .map((item) => ({ quantity: item.quantity, soldAt: sale.soldAt })),
    );
}

function productSalesRows(
  db: Database,
  productId: string,
  branchIds: string[],
  startDate: string,
  endDate: string,
) {
  return db.sales
    .filter((sale) => branchIds.includes(sale.branchId) && saleDate(sale) >= startDate && saleDate(sale) <= endDate)
    .flatMap((sale) =>
      sale.items
        .filter((item) => item.itemType === "product" && item.productId === productId)
        .map((item) => ({ quantity: item.quantity, soldAt: sale.soldAt })),
    );
}

function monthlyUsage(quantity: number, startDate: string, endDate: string) {
  const days = Math.max(1, Math.ceil((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1);
  return Math.round((quantity / days) * 30 * 100) / 100;
}

function daysUntilStockout(currentStock: number, averageMonthlyUsage: number) {
  if (averageMonthlyUsage <= 0) return 999;
  return Math.max(0, Math.floor(currentStock / (averageMonthlyUsage / 30)));
}

function daysSinceLatestSale(values: string[]) {
  const latest = values.map((value) => Date.parse(value)).filter(Number.isFinite).sort((a, b) => b - a)[0];
  if (!latest) return 999;
  return Math.max(0, Math.floor((Date.now() - latest) / 86400000));
}

function stablePatientId(sale: Sale) {
  const raw = `${sale.customerPhone || ""}:${sale.customerName || ""}`.toLowerCase();
  return `patient_${createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}

function saleDate(sale: Sale) {
  return sale.soldAt.slice(0, 10);
}

function requireText(value: unknown, label: string) {
  const result = text(value);
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function validDate(value: unknown) {
  const result = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) && Number.isFinite(Date.parse(result)) && new Date(result).toISOString().slice(0, 10) === result ? result : "";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
