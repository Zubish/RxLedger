import type { Database, Role, User } from "../_shared.js";

export type RaiCapability =
  | "inventory_analytics"
  | "sales_analytics"
  | "financial_analytics"
  | "continuity_analytics";

const capabilityByRole: Record<Role, RaiCapability[]> = {
  admin: ["inventory_analytics", "sales_analytics", "financial_analytics", "continuity_analytics"],
  pharmacist: ["inventory_analytics", "sales_analytics", "continuity_analytics"],
  inventory: ["inventory_analytics"],
  cashier: [],
  viewer: [],
};

export function resolveRaiAccessScope(input: {
  db: Database;
  user: User;
  requestedBranchIds: string[];
  requiredCapabilities: RaiCapability[];
  today?: string;
}) {
  if (input.user.status !== "active" || !input.requiredCapabilities.length || !input.requestedBranchIds.length) {
    return { ok: false as const, reason: "An active user, explicit branches and capabilities are required." };
  }
  const capabilities = capabilityByRole[input.user.role] || [];
  const missingCapabilities = input.requiredCapabilities.filter((capability) => !capabilities.includes(capability));
  if (missingCapabilities.length) return { ok: false as const, reason: "Your RxLedger role cannot access this type of Rai analysis." };

  const activeBranches = input.db.branches.filter((branch) => branch.active);
  const globalAdmin = input.user.role === "admin" && (!input.db.settings.primaryAdminId || input.db.settings.primaryAdminId === input.user.id);
  const today = input.today || new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  const hasActiveBranchAssignment = (user: User, branchId: string) =>
    (user.branchIds.includes(branchId) || user.managedBranchIds.includes(branchId)) &&
    (!user.branchAccessExpiresAt?.[branchId] || user.branchAccessExpiresAt[branchId] >= today);
  const allowedBranchIds = globalAdmin
    ? activeBranches.map((branch) => branch.id)
    : activeBranches.filter((branch) => hasActiveBranchAssignment(input.user, branch.id)).map((branch) => branch.id);
  const branchIds = input.requestedBranchIds.length ? input.requestedBranchIds : allowedBranchIds;
  if (!branchIds.length || branchIds.some((branchId) => !allowedBranchIds.includes(branchId))) {
    return { ok: false as const, reason: "Your RxLedger access does not include one or more requested branches." };
  }

  return { ok: true as const, branchIds: [...new Set(branchIds)], capabilities: [...new Set(input.requiredCapabilities)] };
}
