import {loadServerModule} from "./helpers/load-server-module.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { snapshotHeavyCollections, buildDatabasePatch } from "../src/databasePatch.ts";
import { accessibleBranchIds, canAccessPatientRegistry, primaryAdminIdForDatabase, productQuantityInBranches, scopeDatabaseForUser } from "../server/branch-scope.ts";
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
const patientAuditCalls = [];
const globalAccess = (actor, primary) => accessibleBranchIds(actor, primary) === null;
const assignment = (actor, branch) => (accessibleBranchIds(actor) ?? []).includes(branch);
mutationModule.require = (name) => {
 if(name.endsWith("patient-registry.js")) return loadServerModule("server/patient-registry.ts");
 if(name.endsWith("financial.js")) return loadServerModule("src/financial.ts");
 if(name.endsWith("patientRegistry.js")) return loadServerModule("src/patientRegistry.ts");
 if(name === "node:crypto") return require(name);
 if(name.endsWith("alertPolicy.js")) return {inventoryAlerts};
 if (name.endsWith("branch-scope.js")) return { accessibleBranchIds, canAccessPatientRegistry, primaryAdminIdForDatabase, productQuantityInBranches, scopeDatabaseForUser };
 if (name.endsWith("databasePatch.js")) return { snapshotHeavyCollections, buildDatabasePatch };
 if (name.endsWith("_shared.js")) return {
  canAdmin: globalAccess, hasActiveBranchAssignment: assignment,
  canAdjust: actor => ["admin", "pharmacist"].includes(actor.role),
  daysUntil: value => Math.ceil((new Date(value).getTime() - new Date("2026-10-09").getTime()) / 86400000),
  canWrite: actor => actor.role !== "viewer", canWriteBranch: (actor, branch, primary) => globalAccess(actor, primary) || assignment(actor, branch),
  canManageBranch: () => false, addAudit: (...args) => patientAuditCalls.push(args), id: () => `generated-${++nextId}`,
  nowIso: () => "2026-10-09T10:00:00Z", today: () => "2026-10-09",
 };
 throw new Error(`Unexpected dependency: ${name}`);
};
mutationModule._compile(ts.transpileModule(readFileSync(actionFilename, "utf8") + "\nexport { updatePatientProfile, clearPosDraft, sendChatMessage, upsertProduct, markChatRead, normalizePatientDetails, patientDetailsForSale, receiveStock, recordSale, issueStock, adjustStock, fulfillContinuityRequestsFromSale };", { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, actionFilename);
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

test("patient demographics and allergy updates are branch-scoped and audited with before/after",()=>{
 const state=structuredClone(db);
 const old={age:35,gender:"female",allergyStatus:"none",allergies:"",updatedAt:"2026-01-01",ageRecordedAt:"2026-01-01"};
 state.sales=[{id:"sa",branchId:"a",customerName:"Jane",customerPhone:"080123",soldAt:"2026-01-01",patientDetails:structuredClone(old)},{id:"sb",branchId:"b",customerName:"Jane",customerPhone:"080123",soldAt:"2026-01-01",patientDetails:structuredClone(old)}];
 state.posDrafts=[{branchId:"a",customerName:"Jane",customerPhone:"080123"}];state.continuityRequests=[];
 mutations.updatePatientProfile(state,"local",{branchId:"a",oldPatientPhone:"080123",patientName:"Jane",patientPhone:"080123",patientDetails:{age:36,gender:"female",allergyStatus:"recorded",allergies:"Penicillin: rash"}});
 assert.equal(state.sales[0].patientDetails.allergies,"Penicillin: rash");
 assert.deepEqual(state.sales[1].patientDetails,old);
 assert.equal(state.posDrafts[0].patientDetails.age,36);
 const audit=patientAuditCalls.at(-1);
 assert.equal(audit[3],"patient-profile");assert.equal(audit[5].matchingSales[0].patientDetails.allergyStatus,"none");assert.equal(audit[6].patientDetails.allergies,"Penicillin: rash");
 assert.equal(audit[6].branchId,"a");
 const previous=structuredClone(state.sales);
 assert.throws(()=>mutations.updatePatientProfile(state,"local",{branchId:"a",oldPatientPhone:"080123",patientName:"Jane",patientPhone:"080123",patientDetails:{age:-1,allergyStatus:"none"}}),/age/);
 assert.deepEqual(state.sales,previous);
});
test("unknown allergies stay unknown, invalid entries are rejected, and sale inheritance is branch-specific",()=>{
 assert.equal(mutations.normalizePatientDetails({allergyStatus:"unknown"}).allergyStatus,"unknown");
 assert.throws(()=>mutations.normalizePatientDetails({allergyStatus:"recorded",allergies:" "}),/Describe/);
 assert.throws(()=>mutations.normalizePatientDetails({age:131}),/age/);
 assert.throws(()=>mutations.normalizePatientDetails({gender:"invalid"}),/gender/);
 const state={sales:[{branchId:"b",customerPhone:"080123",soldAt:"2026-01-01",patientDetails:{allergyStatus:"recorded",allergies:"Private branch"}}]};
 assert.equal(mutations.patientDetailsForSale(state,"a","080123",undefined),undefined);
 assert.equal(mutations.patientDetailsForSale(state,"b","080123",undefined).allergies,"Private branch");
});


function stockFixture() {
 const state=structuredClone(db);
 state.settings={...state.settings,autoPricingEnabled:true,globalMarkupPercent:30,pricingRoundingRule:0};
 state.medicines=[{id:"m",sku:"M",brandName:"Synthetic medicine",genericName:"Example",category:"",nafdacNumber:"",active:true,packSize:28,costPrice:0,sellingPrice:0}];
 state.products=[];state.suppliers=[{id:"supplier"}];state.batches=[];state.ledger=[];state.sales=[];state.posDrafts=[];state.receipts=[];state.continuityRequests=[];
 return state;
}
function receive(state, overrides={}) {
 mutations.receiveStock(state,"local","pharmacist",{branchId:"a",supplierId:"supplier",items:[{itemId:"m",quantity:1,unitCost:2800,sellingPrice:130,batchNumber:"TEST",expiryDate:"2028-01-01",...overrides}]});
}
function sell(state, quantities, extra={}) {
 mutations.recordSale(state,"local","pharmacist",{operationId:require("node:crypto").randomUUID(),branchId:"a",items:quantities.map(quantity=>({itemType:"medicine",itemId:"m",quantity})),...extra});
}
test("receive, repeated medicine lines, sale totals, issue and return reconcile in least units",()=>{
 const state=stockFixture();receive(state);
 const batch=state.batches[0].id;
 assert.equal(state.ledger.reduce((sum,row)=>sum+row.quantity,0),28);
 assert.equal(state.batches[0].unitCost,100);
 assert.equal(state.medicines[0].sellingPrice,130);
 sell(state,[10,10]);
 assert.equal(state.sales[0].subtotal,2600);
 assert.equal(state.sales[0].total,2600);
 assert.equal(state.sales[0].items.reduce((sum,row)=>sum+row.quantity,0),20);
 assert.equal(state.ledger.filter(row=>row.batchId===batch).reduce((sum,row)=>sum+row.quantity,0),8);
 mutations.issueStock(state,"local","pharmacist",{branchId:"a",medicineId:"m",quantity:3});
 mutations.adjustStock(state,"local","pharmacist",{batchId:batch,mode:"customer-return",quantity:2,reason:"Synthetic physical return"});
 assert.equal(state.ledger.filter(row=>row.batchId===batch).reduce((sum,row)=>sum+row.quantity,0),7);
});
test("repeated lines cannot oversell a batch and failed medicine sale leaves stock/sales unchanged",()=>{
 const state=stockFixture();receive(state);const before=structuredClone(state);
 assert.throws(()=>sell(state,[20,20]),/enough non-expired stock/);
 assert.deepEqual(state,before);
});
test("FEFO allocates early expiry first, skips expired stock and preserves another branch",()=>{
 const state=stockFixture();receive(state,{expiryDate:"2028-01-01"});receive(state,{expiryDate:"2027-01-01"});
 const early=state.batches.find(row=>row.expiryDate==="2027-01-01").id;
 state.batches.push({id:"expired",branchId:"a",medicineId:"m",expiryDate:"2020-01-01"},{id:"foreign",branchId:"b",medicineId:"m",expiryDate:"2026-12-01"});
 state.ledger.push({batchId:"expired",quantity:100},{batchId:"foreign",quantity:100});
 sell(state,[30]);
 assert.deepEqual(state.sales[0].items.map(row=>row.quantity),[28,2]);
 assert.equal(state.sales[0].items[0].batchId,early);
 assert.equal(state.ledger.filter(row=>row.batchId==="foreign").reduce((sum,row)=>sum+row.quantity,0),100);
 assert.equal(state.ledger.filter(row=>row.batchId==="expired").reduce((sum,row)=>sum+row.quantity,0),100);
});
test("sale fulfilment cannot change matching patient requests from a different branch",()=>{
 const state=stockFixture();receive(state);
 state.continuityRequests=["a","b"].map(branch=>({id:branch,originBranchId:branch,patientName:"Synthetic",patientPhone:"080123",medicineId:"m",status:"open"}));
 sell(state,[1],{customerName:"Synthetic",customerPhone:"080123"});
 assert.deepEqual(state.continuityRequests.map(row=>row.status),["fulfilled","open"]);
});
test("expired, foreign or already-consumed draft cannot fall back to a fresh sale",()=>{
 const state=stockFixture();receive(state);const before=structuredClone(state);
 assert.throws(()=>sell(state,[1],{draftId:"already-completed"}),/draft is expired, already completed or unavailable/);
 assert.deepEqual(state,before);
});
test("invalid adjustment directions and quantities are rejected without ledger changes",()=>{
 const state=stockFixture();receive(state);const before=structuredClone(state);
 for(const input of [{mode:"write-off",quantity:-5},{mode:"customer-return",quantity:0},{mode:"stock-in",quantity:2},{mode:"bogus",quantity:2},{mode:"supplier-return",quantity:29}])
  assert.throws(()=>mutations.adjustStock(state,"local","pharmacist",{batchId:state.batches[0].id,reason:"test",...input}));
 assert.deepEqual(state,before);
});
test("negative and non-finite receiving costs cannot corrupt least-unit prices",()=>{
 for(const unitCost of [-1,Infinity,"not-a-number"]) {
  const state=stockFixture();const before=structuredClone(state);
  assert.throws(()=>receive(state,{unitCost}));assert.deepEqual(state,before);
 }
});
test("a stale POS/draft allergy snapshot never replaces the current branch profile",()=>{
 const state=stockFixture();
 const current={age:44,gender:"male",allergyStatus:"recorded",allergies:"Penicillin: rash",updatedAt:"2026-10-09T09:00:00Z"};
 state.sales=[{branchId:"a",customerPhone:"080123",soldAt:"2026-10-09",patientDetails:current}];
 const stale={allergyStatus:"none",allergies:"",updatedAt:"2026-10-01"};
 assert.deepEqual(mutations.patientDetailsForSale(state,"a","080123",stale,{customerPhone:"080123",patientDetails:stale}),current);
 assert.equal(mutations.patientDetailsForSale(state,"b","080123",undefined),undefined);
});

test("receiving computes configured category/SKU markup and custom rounding per tablet",()=>{
 const state=stockFixture();state.settings.pricingRoundingRule=25;
 state.settings.productMarkupPercentages={"medicine:m":50};
 receive(state,{sellingPrice:9999});
 assert.equal(state.batches[0].unitCost,100);
 assert.equal(state.batches[0].sellingPrice,150);
 assert.equal(state.medicines[0].sellingPrice,150);
 state.settings.autoPricingEnabled=false;
 for(const sellingPrice of [-1,Infinity,"invalid"])
  assert.throws(()=>receive(state,{sellingPrice}));
});
