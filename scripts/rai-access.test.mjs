import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRaiAccessScope } from "../server/rai/access-policy.ts";

const db = { settings: { primaryAdminId: "owner" }, branches: [{ id: "lagos", active: true }, { id: "abuja", active: true }] };
const user = { id: "staff", role: "pharmacist", status: "active", branchIds: ["lagos"], managedBranchIds: [] };
const input = { db, user, requestedBranchIds: ["lagos"], requiredCapabilities: ["inventory_analytics"], today: "2026-10-07" };
test("returns only the requested capability", () => {
  assert.deepEqual(resolveRaiAccessScope(input), { ok: true, branchIds: ["lagos"], capabilities: ["inventory_analytics"] });
});
test("rejects other branches and financial access", () => {
  assert.equal(resolveRaiAccessScope({ ...input, requestedBranchIds: ["abuja"] }).ok, false);
  assert.equal(resolveRaiAccessScope({ ...input, requiredCapabilities: ["financial_analytics"] }).ok, false);
});
test("rejects expired assignments, suspended users and wildcard branches", () => {
  assert.equal(resolveRaiAccessScope({ ...input, user: { ...user, branchAccessExpiresAt: { lagos: "2026-10-06" } } }).ok, false);
  assert.equal(resolveRaiAccessScope({ ...input, user: { ...user, status: "suspended" } }).ok, false);
  assert.equal(resolveRaiAccessScope({ ...input, requestedBranchIds: ["all"] }).ok, false);
});
test("only the primary admin has automatic company-wide branch scope", () => {
  assert.equal(resolveRaiAccessScope({ ...input, user: { ...user, role: "admin" }, requestedBranchIds: ["abuja"] }).ok, false);
  assert.equal(resolveRaiAccessScope({ ...input, user: { ...user, id: "owner", role: "admin" }, requestedBranchIds: ["abuja"] }).ok, true);
});
