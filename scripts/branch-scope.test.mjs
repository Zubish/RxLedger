import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { snapshotHeavyCollections, buildDatabasePatch } from "../src/databasePatch.ts";
import { accessibleBranchIds, primaryAdminIdForDatabase, productQuantityInBranches, scopeDatabaseForUser } from "../server/branch-scope.ts";
import { inventoryAlerts } from "../src/alertPolicy.ts";
const user = { id: "local", role: "pharmacist", status: "active", branchIds: ["a", "expired"], managedBranchIds: [], branchAccessExpiresAt: { expired: "2000-01-01" } };
const foreign = { ...user, id: "foreign", branchIds: ["b"] };
const global = { ...user, id: "admin", role: "admin" };
const db = {
 settings: { primaryAdminId: "admin" }, users: [user, foreign, global],
 branches: [{ id: "a", active: true }, { id: "b", active: true }], batches: [{ id: "ba", branchId: "a" }, { id: "bb", branchId: "b" }],
 medicines: [], products: [], suppliers: [],
 sales: [{ id: "sa", branchId: "a" }, { id: "sb", branchId: "b" }],
 posDrafts: [{ branchId: "a" }, { branchId: "b" }], ledger: [{ batchId: "ba" }, { batchId: "bb" }],
 stockSnapshot: [{ batchId: "ba", quantity: 1 }, { batchId: "bb", quantity: 100 }],
 ledgerSummary: { todayMovementCountsByBatchId: { ba: 1, bb: 100 }, todayMovementCountsByBranchId: { a: 1, b: 100 } },
 receipts: [{ items: [{ batchId: "ba" }, { batchId: "bb" }] }],
 continuityRequests: [{ id: "ca", originBranchId: "a", matchedBranchId: "b" }, { id: "cb", originBranchId: "b", matchedBranchId: "a" }],
 requisitions: [], branchAccessRequests: [{ branchId: "a" }, { branchId: "b" }],
 chatMessages: [{ userId: "foreign", body: "secret" }, { userId: "local", branchId: "a", body: "local" }, { userId: "local", channel: "direct", recipientUserId: "foreign", body: "foreign direct" }],
 auditLogs: [{ before: "secret" }], passwordResetRequests: [{ userId: "foreign" }], securityEvents: [{ userId: "foreign" }],
};
test("expired and unassigned branches never grant access; only designated admin is global", () => {
 assert.deepEqual(accessibleBranchIds(user), ["a"]);
 assert.deepEqual(accessibleBranchIds({ ...user, role: "admin" }, "admin"), ["a"]);
 assert.equal(accessibleBranchIds(global, "admin"), null);
});
test("all operational payloads and summaries exclude foreign branches without changing stored data", () => {
 const scoped = scopeDatabaseForUser(db, user);
 assert.deepEqual(scoped.sales.map(row => row.id), ["sa"]);
 assert.deepEqual(scoped.branches.map(row => row.id), ["a"]);
 assert.deepEqual(scoped.stockSnapshot.map(row => row.quantity), [1]);
 assert.deepEqual(scoped.ledgerSummary.todayMovementCountsByBranchId, { a: 1 });
 assert.deepEqual(scoped.receipts[0].items, [{ batchId: "ba" }]);
 assert.deepEqual(scoped.continuityRequests.map(row => row.id), ["ca"]);
 assert.equal(scoped.continuityRequests[0].matchedBranchId, undefined);
 assert.deepEqual(scoped.users.map(row => row.id), ["local", "admin"]);
 assert.deepEqual(scoped.chatMessages.map(row => row.body), ["local"]);
 assert.equal(scoped.securityEvents.length + scoped.passwordResetRequests.length + scoped.auditLogs.length, 0);
 assert.equal(db.sales.length, 2);
 assert.equal(db.receipts[0].items.length, 2);
 assert.deepEqual(scopeDatabaseForUser(db, global).sales, db.sales);
});
test("users without branches receive no operational data", () => {
 const scoped = scopeDatabaseForUser(db, { ...user, branchIds: [] });
 assert.equal(scoped.sales.length + scoped.batches.length + scoped.continuityRequests.length, 0);
});
test("history SQL filters branch access before applying pagination limits", () => {
 const source = readFileSync(resolve("server/_shared.ts"), "utf8");
 for (const name of ["loadTenantSalesPage", "loadTenantLedgerPage"]) {
  const body = source.slice(source.indexOf(`export async function ${name}`));
  assert.ok(body.indexOf("options.branchIds == null") < body.indexOf("LIMIT ${queryLimit}"));
 }
});

test("Mart quantities use only signed movements in authorized branches, including sales", () => {
 const stock = { ...db, products: [{ id: "p", quantity: 95 }], ledger: [
  { itemType: "product", productId: "p", toBranchId: "a", quantity: 10 },
  { itemType: "product", productId: "p", fromBranchId: "a", quantity: -5 },
  { itemType: "product", productId: "p", toBranchId: "b", quantity: 90 },
 ] };
 assert.equal(productQuantityInBranches(stock, "p", ["a"]), 5);
 assert.equal(scopeDatabaseForUser(stock, user).products[0].quantity, 5);
 assert.deepEqual(scopeDatabaseForUser(stock, user).products[0].quantityByBranch, { a: 5 });
 assert.deepEqual(scopeDatabaseForUser(stock, global).products[0].quantityByBranch, { a: 5, b: 90 });
 assert.equal(scopeDatabaseForUser(stock, user).ledger.length, 2);
 assert.equal(scopeDatabaseForUser(stock, global).products[0].quantity, 95);
});

test("mutation deltas include only scoped records and never reveal foreign removed IDs", () => {
 const before = snapshotHeavyCollections(scopeDatabaseForUser(db, user));
 const changed = { ...db, sales: [{ id: "sa", branchId: "a", note: "updated" }, { id: "sb", branchId: "b", secret: "changed" }] };
 const patch = buildDatabasePatch(before, scopeDatabaseForUser(changed, user));
 assert.deepEqual(patch.sales.upserts.map(row => row.id), ["sa"]);
 assert.deepEqual(patch.sales.removedIds, []);
 assert.deepEqual(patch.auditLogs.upserts, []);
 const removed = buildDatabasePatch(before, scopeDatabaseForUser({ ...db, sales: [] }, user));
 assert.deepEqual(removed.sales.removedIds, ["sa"]);
});
test("authenticated API responses and history routes consistently use server branch scope", () => {
 for (const route of ["api/state.ts", "api/auth/login.ts", "api/action.ts"]) {
  const source = readFileSync(resolve(route), "utf8");
  assert.ok(source.includes("scopeDatabaseForUser(sanitizeDatabase("), route);
 }
 const state = readFileSync(resolve("api/state.ts"), "utf8");
 assert.match(state, /loadTenantSalesPage\(companySlug, \{ cursor, limit, branchIds: accessibleBranchIds/);
 assert.match(state, /loadTenantLedgerPage\(companySlug, \{ cursor, limit, branchIds: accessibleBranchIds/);
});

test("historical unattributed chat stays global and new messages require authorized branch ownership", () => {
 const messages = { ...db, chatMessages: [
  { userId: "local", body: "legacy" },
  { userId: "local", branchId: "b", body: "foreign branch" },
  { userId: "local", branchId: "a", body: "authorized" },
 ] };
 assert.deepEqual(scopeDatabaseForUser(messages, user).chatMessages.map(row => row.body), ["authorized"]);
 assert.equal(scopeDatabaseForUser(messages, global).chatMessages.length, 3);
 const source = readFileSync(resolve("api/action.ts"), "utf8");
 const send = source.slice(source.indexOf("function sendChatMessage("));
 assert.match(send, /requireString\(payload\?\.branchId, "Branch"\)/);
 assert.match(send, /hasActiveBranchAssignment\(actor, branchId\)/);
});

// Execute the real mutation functions with deterministic auth/clock dependencies; no database is contacted.
const require = createRequire(resolve("package.json"));
const ts = require("typescript");
const actionFilename = resolve("api/action.ts");
const mutationModule = new Module(actionFilename);
let nextId = 0;
const globalAccess = (actor, primary) => accessibleBranchIds(actor, primary) === null;
const assignment = (actor, branch) => (accessibleBranchIds(actor) ?? []).includes(branch);
mutationModule.require = (name) => {
 if(name.endsWith("alertPolicy.ts")) return {inventoryAlerts};
 if (name.endsWith("branch-scope.js")) return { accessibleBranchIds, primaryAdminIdForDatabase, productQuantityInBranches, scopeDatabaseForUser };
 if (name.endsWith("databasePatch.js")) return { snapshotHeavyCollections, buildDatabasePatch };
 if (name.endsWith("_shared.js")) return {
  canAdmin: globalAccess, hasActiveBranchAssignment: assignment,
  canWrite: actor => actor.role !== "viewer", canWriteBranch: (actor, branch, primary) => globalAccess(actor, primary) || assignment(actor, branch),
  canManageBranch: () => false, addAudit: () => {}, id: () => `generated-${++nextId}`,
  nowIso: () => "2026-10-09T10:00:00Z", today: () => "2026-10-09",
 };
 throw new Error(`Unexpected dependency: ${name}`);
};
mutationModule._compile(ts.transpileModule(readFileSync(actionFilename, "utf8") + "\nexport { updatePatientProfile, clearPosDraft, sendChatMessage, upsertProduct, markChatRead };", { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, actionFilename);
const mutations = mutationModule.exports;
test("patient corrections never update another branch's matching phone/name", () => {
 const patientDb = structuredClone(db);
 patientDb.sales = [{ id: "sa", branchId: "a", customerName: "Old", customerPhone: "080123" }, { id: "sb", branchId: "b", customerName: "Old", customerPhone: "080123" }];
 patientDb.posDrafts = [{ branchId: "a", customerName: "Old", customerPhone: "080123" }, { branchId: "b", customerName: "Old", customerPhone: "080123" }];
 patientDb.continuityRequests = [{ originBranchId: "a", patientName: "Old", patientPhone: "080123" }, { originBranchId: "b", patientName: "Old", patientPhone: "080123" }];
 mutations.updatePatientProfile(patientDb, "local", { branchId: "a", oldPatientPhone: "080123", patientName: "Corrected", patientPhone: "080456" });
 assert.deepEqual(patientDb.sales.map(row => row.customerName), ["Corrected", "Old"]);
 assert.deepEqual(patientDb.posDrafts.map(row => row.customerName), ["Corrected", "Old"]);
 assert.deepEqual(patientDb.continuityRequests.map(row => row.patientName), ["Corrected", "Old"]);
});
test("arbitrary draft IDs and foreign chat branches cannot bypass write authorization", () => {
 const mutable = structuredClone(db);
 mutable.posDrafts = [{ id: "foreign-draft", branchId: "b", userId: "foreign" }];
 assert.throws(() => mutations.clearPosDraft(mutable, "local", { branchId: "b", draftId: "foreign-draft" }), /permission/);
 mutations.clearPosDraft(mutable, "local", { branchId: "a", draftId: "foreign-draft" });
 assert.equal(mutable.posDrafts.length, 1);
 assert.throws(() => mutations.sendChatMessage(mutable, "local", { branchId: "b", body: "secret" }), /access/);
 assert.throws(() => mutations.sendChatMessage(mutable, "local", { body: "missing branch" }), /Branch/);
});
test("editing Mart branch stock writes a signed adjustment and preserves other branches", () => {
 const mutable = structuredClone(db);
 mutable.products = [{ id: "p", sku: "P", name: "Product", costPrice: 1, sellingPrice: 2, quantity: 95, barcodes: [] }];
 mutable.ledger = [{ itemType: "product", productId: "p", toBranchId: "a", quantity: 5 }, { itemType: "product", productId: "p", toBranchId: "b", quantity: 90 }];
 mutations.upsertProduct(mutable, "local", "pharmacist", { branchId: "a", record: { ...mutable.products[0], quantity: 8 } });
 assert.equal(mutable.products[0].quantity, 98);
 assert.equal(productQuantityInBranches(mutable, "p", ["a"]), 8);
 assert.equal(productQuantityInBranches(mutable, "p", ["b"]), 90);
 assert.throws(() => mutations.upsertProduct(mutable, "local", "pharmacist", { branchId: "b", record: mutable.products[0] }), /permission/);
});

test("legacy workspaces grant global access only to their first active admin", () => {
 const second = { ...global, id: "second", branchIds: ["b"] };
 const legacy = { ...db, settings: {}, users: [global, second, user] };
 assert.equal(primaryAdminIdForDatabase(legacy), "admin");
 assert.deepEqual(scopeDatabaseForUser(legacy, second).sales.map(row => row.id), ["sb"]);
 assert.equal(scopeDatabaseForUser(legacy, global).sales.length, 2);
 assert.deepEqual(accessibleBranchIds(second), ["b"]);
 const state = readFileSync(resolve("api/state.ts"), "utf8");
 assert.match(state, /accessibleBranchIds\(user, primaryAdminIdForDatabase\(authDb\)\)/);
});
test("branch read timestamps preserve unread work in other branches and reject foreign branches", () => {
 const mutable = structuredClone(db);
 mutable.users[0].lastChatSeenAtByBranch = { expired: "2020-01-01T00:00:00Z" };
 mutations.markChatRead(mutable, "local", { branchId: "a" });
 assert.equal(mutable.users[0].lastChatSeenAtByBranch.a, "2026-10-09T10:00:00Z");
 assert.equal(mutable.users[0].lastChatSeenAtByBranch.expired, "2020-01-01T00:00:00Z");
 assert.throws(() => mutations.markChatRead(mutable, "local", { branchId: "b" }), /access/);
 assert.throws(() => mutations.markChatRead(mutable, "local"), /Branch/);
 assert.throws(() => mutations.upsertProduct(mutable, "admin", "admin", { branchId: "missing", record: {} }), /Active branch/);
});
test("global admin can participate in branch-owned chat without exposing private admin metadata", () => {
 const mutable = structuredClone(db);
 mutable.users.find(row => row.id === "admin").knownDevices = [{ id: "private-device" }];
 mutations.sendChatMessage(mutable, "local", { branchId: "a", channel: "direct", recipientUserId: "admin", body: "Help" });
 mutations.sendChatMessage(mutable, "admin", { branchId: "a", channel: "direct", recipientUserId: "local", body: "Reply" });
 const scoped = scopeDatabaseForUser(mutable, user);
 assert.deepEqual(scoped.chatMessages.filter(row => row.channel === "direct").map(row => row.body), ["Reply", "Help"]);
 const adminIdentity = scoped.users.find(row => row.id === "admin");
 assert.equal(adminIdentity.knownDevices, undefined);
 assert.equal(adminIdentity.email, "");
 assert.equal(adminIdentity.phone, "");
});

test("multi-branch staff patient edits affect only the explicitly selected branch", () => {
 const mutable = structuredClone(db);
 mutable.users[0].branchIds = ["a", "b"];
 mutable.sales = [{ id: "sa", branchId: "a", customerName: "Old", customerPhone: "080123" }, { id: "sb", branchId: "b", customerName: "Old", customerPhone: "080123" }];
 mutable.posDrafts = [];
 mutable.continuityRequests = [];
 const payload = { oldPatientPhone: "080123", patientName: "Corrected", patientPhone: "080456" };
 assert.throws(() => mutations.updatePatientProfile(mutable, "local", payload), /Branch/);
 assert.throws(() => mutations.updatePatientProfile(mutable, "local", { ...payload, branchId: "expired" }), /access/);
 mutations.updatePatientProfile(mutable, "local", { ...payload, branchId: "a" });
 assert.deepEqual(mutable.sales.map(row => row.customerName), ["Corrected", "Old"]);
 mutations.updatePatientProfile(mutable, "admin", { ...payload, patientName: "Global correction" });
 assert.deepEqual(mutable.sales.map(row => row.customerName), ["Corrected", "Global correction"]);
});
