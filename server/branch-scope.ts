import type { Database, User } from "../src/types.js";

/** Null means global access; an empty array means no operational access. */
export function accessibleBranchIds(user: User, primaryAdminId = "", date = new Date().toISOString().slice(0, 10)): string[] | null {
  if (user.role === "admin" && Boolean(primaryAdminId) && user.id === primaryAdminId) return null;
  return [...new Set([...user.branchIds, ...user.managedBranchIds])].filter(id => {
    const expiry = user.branchAccessExpiresAt?.[id];
    return !expiry || expiry >= date;
  });
}

/** Legacy workspaces designate their first active admin, matching mutation authorization. */
export function primaryAdminIdForDatabase(db: Pick<Database, "settings" | "users">): string {
  return db.settings.primaryAdminId || db.users.find(user => user.role === "admin" && user.status === "active")?.id || "";
}

/** Product stock has no batches; its signed ledger movements carry branch ownership. */
export function productQuantityInBranches(db: Database, productId: string, branchIds: string[]): number {
  const allowed = new Set(branchIds);
  return Math.max(0, db.ledger.reduce((total, entry) => entry.itemType === "product" && entry.productId === productId && allowed.has(entry.toBranchId || entry.fromBranchId || "") ? total + entry.quantity : total, 0));
}

/** Scope every authenticated payload before serializing it, never the stored tenant. */
export function scopeDatabaseForUser(db: Database, user: User): Database {
  const primaryAdminId = primaryAdminIdForDatabase(db);
  const ids = accessibleBranchIds(user, primaryAdminId);
  const quantityByProduct = new Map<string, Record<string, number>>();
  db.ledger.forEach(entry => {
    const branchId = entry.toBranchId || entry.fromBranchId || "";
    if (entry.itemType !== "product" || !entry.productId || !branchId || (ids !== null && !ids.includes(branchId))) return;
    const quantities = quantityByProduct.get(entry.productId) ?? {};
    quantities[branchId] = (quantities[branchId] ?? 0) + entry.quantity;
    quantityByProduct.set(entry.productId, quantities);
  });
  const products = db.products.map(product => {
    const quantityByBranch = Object.fromEntries(Object.entries(quantityByProduct.get(product.id) ?? {}).map(([id, quantity]) => [id, Math.max(0, quantity)]));
    return { ...product, quantityByBranch, quantity: ids === null ? product.quantity : Object.values(quantityByBranch).reduce((sum, quantity) => sum + quantity, 0) };
  });
  if (ids === null) return { ...db, products };
  const allowed = new Set(ids);
  const branches = db.branches.filter(branch => allowed.has(branch.id));
  const batches = db.batches.filter(batch => allowed.has(batch.branchId));
  const batchIds = new Set(batches.map(batch => batch.id));
  const staff = db.users.filter(staff => staff.id === user.id || staff.id === primaryAdminId || (accessibleBranchIds(staff, primaryAdminId) ?? []).some(id => allowed.has(id)));
  const staffIds = new Set(staff.map(staff => staff.id));
  const users = staff.map(staff => ({ ...(staff.id === primaryAdminId && staff.id !== user.id
    ? { id: staff.id, name: staff.name, role: staff.role, status: staff.status, email: "", phone: "", createdAt: "", branchIds: [], managedBranchIds: [] }
    : staff),
    branchIds: staff.branchIds.filter(id => allowed.has(id)),
    managedBranchIds: staff.managedBranchIds.filter(id => allowed.has(id)),
    branchAccessExpiresAt: Object.fromEntries(Object.entries(staff.branchAccessExpiresAt ?? {}).filter(([id]) => allowed.has(id))),
    lastChatSeenAtByBranch: staff.id === user.id ? Object.fromEntries(Object.entries(staff.lastChatSeenAtByBranch ?? {}).filter(([id]) => allowed.has(id))) : undefined,
    knownDevices: staff.id === user.id ? staff.knownDevices : undefined,
  }));
  return { ...db, branches, batches, users,
    products,
    sales: db.sales.filter(sale => allowed.has(sale.branchId)),
    posDrafts: db.posDrafts.filter(draft => allowed.has(draft.branchId)),
    ledger: db.ledger.filter(entry => (entry.itemType === "product" ? allowed.has(entry.toBranchId || entry.fromBranchId || "") : batchIds.has(entry.batchId))),
    stockSnapshot: db.stockSnapshot.filter(entry => batchIds.has(entry.batchId)),
    ledgerSummary: { ...db.ledgerSummary,
      todayMovementCountsByBatchId: Object.fromEntries(Object.entries(db.ledgerSummary.todayMovementCountsByBatchId).filter(([id]) => batchIds.has(id))),
      todayMovementCountsByBranchId: Object.fromEntries(Object.entries(db.ledgerSummary.todayMovementCountsByBranchId).filter(([id]) => allowed.has(id))),
    },
    receipts: db.receipts.map(receipt => ({ ...receipt, items: receipt.items.filter(item => item.itemType === "product" ? allowed.has(item.branchId || "") : batchIds.has(item.batchId)) })).filter(receipt => receipt.items.length),
    continuityRequests: db.continuityRequests.filter(request => allowed.has(request.originBranchId)).map(request => ({ ...request,
      preferredBranchId: request.preferredBranchId && allowed.has(request.preferredBranchId) ? request.preferredBranchId : undefined,
      matchedBranchId: request.matchedBranchId && allowed.has(request.matchedBranchId) ? request.matchedBranchId : undefined,
    })),
    requisitions: db.requisitions.filter(request => allowed.has(request.requestingBranchId) || allowed.has(request.sourceBranchId)),
    branchAccessRequests: db.branchAccessRequests.filter(request => allowed.has(request.branchId)),
    // Historical messages have no provable branch ownership; retain them for global audit only.
    chatMessages: db.chatMessages.filter(message => message.branchId && allowed.has(message.branchId) && (message.channel === "direct"
      ? (message.userId === user.id || message.recipientUserId === user.id) && staffIds.has(message.userId) && (!message.recipientUserId || staffIds.has(message.recipientUserId))
      : staffIds.has(message.userId))),
    auditLogs: [],
    passwordResetRequests: db.passwordResetRequests.filter(request => request.userId === user.id),
    securityEvents: db.securityEvents.filter(event => event.userId === user.id),
  };
}
