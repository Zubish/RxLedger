import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const app = read("src/App.tsx");
const notificationsComponent = read("src/components/Notifications.tsx");
const continuityQueue = read("src/components/ContinuityQueue.tsx");
const patientProfilePanel = read("src/components/PatientProfilePanel.tsx");
const action = read("api/action.ts");
const state = read("api/state.ts");
const bootstrap = read("api/bootstrap.ts");
const login = read("api/auth/login.ts");
const raiSnapshot = read("api/rai/analytics-snapshot.ts");
const api = read("src/api.ts");
const databasePatch = read("src/databasePatch.ts");
const shared = read("api/_shared.ts");
const reset = read("api/auth/request-password-reset.ts");
const types = read("src/types.ts");
const readme = read("README.md");
const blueprint = read("docs/APP_BLUEPRINT.md");
const modules = read("docs/RXLEDGER_ECOSYSTEM_MODULES.md");

function assertAbsent(source, pattern, message) {
  assert.equal(pattern.test(source), false, message);
}

function assertPresent(source, pattern, message) {
  assert.equal(pattern.test(source), true, message);
}

assertPresent(
  types,
  /type Role = .*cashier.*viewer/,
  "RxLedger community pharmacy roles should still include cashier.",
);
assertPresent(
  app,
  /cashier: "Cashier"/,
  "RxLedger should keep a visible cashier role label for POS checkout.",
);
assertPresent(
  app,
  /\{ id: "products", label: "Mart"/,
  "RxLedger should keep Mart/general retail as part of its community pharmacy scope.",
);
assertPresent(
  action,
  /case "savePosDraft"[\s\S]*savePosDraft/,
  "RxLedger should keep prescription/POS draft saving.",
);
assertPresent(
  action,
  /case "clearPosDraft"[\s\S]*clearPosDraft/,
  "RxLedger should keep draft clearing.",
);
assertPresent(
  shared,
  /posDrafts: PosDraft\[\]/,
  "RxLedger should keep POS drafts in its community-pharmacy data model.",
);

assertPresent(
  app,
  /const canCompleteSale =[\s\S]*isSuperAdmin\(db, currentUser\)[\s\S]*currentUser\.role === "pharmacist"[\s\S]*currentUser\.role === "cashier"/,
  "RxLedger sale completion should allow super admin, assigned pharmacists, and cashiers.",
);
assertPresent(
  action,
  /Only authorized branch staff can complete POS sales/,
  "RxLedger backend should enforce authorized branch staff POS completion.",
);
assertPresent(
  action,
  /Cashiers and viewers cannot be branch managers/,
  "Cashier access should not be treated as branch management authority.",
);
assertPresent(
  app,
  /<strong>{db\.settings\.accountName}<\/strong>[\s\S]*<span>Company file<\/span>/,
  "RxLedger sidebar should present the customer company file instead of the software name.",
);
assertAbsent(
  app,
  /<strong>{db\.settings\.softwareName}<\/strong>/,
  "RxLedger sidebar should not show the internal software name.",
);
assertAbsent(
  app,
  /Software name\s*<input/,
  "RxLedger settings should not expose software name as a customer-editable field.",
);
assertPresent(
  action,
  /softwareName:\s*db\.settings\.softwareName/,
  "RxLedger settings updates should preserve the internal software name.",
);
assertPresent(
  app,
  /function getLowStockMedicines[\s\S]*medicine\.reorderLevel > 0[\s\S]*\(totals\.get\(medicine\.id\) \?\? 0\) <= medicine\.reorderLevel/,
  "RxLedger low-stock helper should include zero-stock medicines when reorder level is set.",
);
assertPresent(
  app,
  /const outOfStock = lowStock\.filter\([\s\S]*\(stockTotals\.get\(medicine\.id\) \?\? 0\) <= 0/,
  "RxLedger out-of-stock alerts should be derived from low-stock scope so zero-stock items are not missed.",
);
assertAbsent(
  api,
  /Authorization.+Bearer/,
  "Client API requests should not send stored bearer tokens.",
);
assertPresent(
  api,
  /credentials:\s*"include"/,
  "Client API requests should include the HttpOnly session cookie.",
);
assertPresent(
  shared,
  /HttpOnly; SameSite=Lax/,
  "Session cookies should be HttpOnly and SameSite=Lax.",
);
assertPresent(
  shared,
  /getSessionToken\(req[\s\S]*getCookieToken\(req\) \|\| getBearerToken\(req\)/,
  "Session lookup should prefer cookies while allowing bearer fallback during rollout.",
);
assertPresent(
  reset,
  /randomInt\(100000, 1000000\)/,
  "Password reset codes should use cryptographically secure randomInt.",
);
assert.equal(
  existsSync(join(root, "docs/FREEZE_II_CARE_NETWORK_FIGMA_BLUEPRINT.md")),
  true,
  "RxLedger should preserve the Care Network/HMO blueprint as an ecosystem expansion document.",
);
for (const source of [readme, blueprint, modules]) {
  assertPresent(
    source,
    /RxLedger Core[\s\S]*Patient Continuity[\s\S]*(Continuity Centre|Medication Owed|Backorder)[\s\S]*Clinical Safety Assistant[\s\S]*RxLedger Connect[\s\S]*RxLedger Care Network/s,
    "RxLedger documentation should preserve the ecosystem module map.",
  );
}
assertPresent(
  modules,
  /Do not copy the Totalenergies Pharmacy Inventory implementation directly into RxLedger/,
  "RxLedger Medication Owed/Backorder should be designed separately from Totalenergies Pharmacy Inventory.",
);
assertPresent(
  blueprint,
  /The assistant should not diagnose, prescribe, or autonomously block dispensing/,
  "RxLedger clinical safety guidance should keep pharmacists in control.",
);
assertAbsent(
  app,
  /Pharmacist Safety Review/,
  "RxLedger POS should not expose the removed pharmacist safety review panel.",
);
assertAbsent(
  app,
  /buildPharmacistSafetyReview[\s\S]*why:/,
  "RxLedger should not keep the removed live safety review prompt builder in App.tsx.",
);
assertAbsent(
  app,
  /Allergies or reactions[\s\S]*Current\/chronic medicines/,
  "RxLedger should not expose the removed allergy/chronic medicine safety-review inputs in POS.",
);
assertAbsent(
  app,
  /Controlled\/monitored medicine review/,
  "RxLedger should not expose the removed controlled-medicine safety-review prompt in POS.",
);
assertPresent(
  `${app}\n${continuityQueue}`,
  /transferred: "Transfer requested"[\s\S]*Request transfer/,
  "RxLedger Continuity Centre should support transfer-request status without marking stock fulfilled.",
);

for (const source of [app, action, shared, types]) {
  assertAbsent(
    source,
    /Pending medication|pendingMedications|Medication Owed|Backorder Log/i,
    "RxLedger should not receive the Pharmacy Inventory-only pending medication flow through these tests.",
  );
}

assertPresent(
  `${app}\n${continuityQueue}`,
  /ContinuityCentre[\s\S]*Patient-linked follow-up for unavailable medicines/,
  "RxLedger should keep Continuity Centre as the patient-linked action queue.",
);
assertPresent(
  `${app}\n${continuityQueue}`,
  /Process in POS/,
  "RxLedger Continuity Centre should send available patient needs into POS instead of directly closing them.",
);
assertAbsent(
  app,
  /updateRequest\(request\.id, "fulfilled"\)/,
  "RxLedger Continuity Centre should not mark requests fulfilled outside an actual POS sale.",
);
assertAbsent(
  app,
  /Action queue, not alert flood[\s\S]*Smarter alerts: grouped and actionable/,
  "RxLedger should not show the removed Continuity Centre principle cards.",
);
assertPresent(
  shared,
  /continuityRequests: ContinuityRequest\[\]/,
  "RxLedger should persist continuity requests in its own data model.",
);
assertPresent(
  action,
  /createContinuityRequest[\s\S]*updateContinuityRequest[\s\S]*Matched continuity request to available stock/s,
  "RxLedger should support auditable continuity creation, updates, and stock matching.",
);
assertPresent(
  action,
  /fulfillContinuityRequestsFromSale[\s\S]*request\.resolvedBy = actorId[\s\S]*Fulfilled continuity request from POS sale/s,
  "RxLedger should close matching continuity requests only after POS sale stock deduction and record who sold it.",
);
assertPresent(
  raiSnapshot,
  /requireMethod\(req, res, \["POST"\]\)[\s\S]*getBearerToken\(req\)[\s\S]*timingSafeEqual/,
  "RxLedger Rai analytics snapshot endpoint should be POST-only and protected with constant-time bearer-token validation.",
);
assertPresent(
  raiSnapshot,
  /tenant_id[\s\S]*resolveTenantWorkspace/s,
  "RxLedger Rai analytics snapshot should resolve the TotalEnergies workspace alias.",
);
assertPresent(
  raiSnapshot,
  /stablePatientId[\s\S]*createHash\("sha256"\)/s,
  "RxLedger Rai analytics snapshot should expose stable hashed patient IDs instead of names or phone numbers.",
);
assertPresent(
  `${app}\n${continuityQueue}`,
  /continuityGroups[\s\S]*continuity-patient-name[\s\S]*continuity-request-list/s,
  "RxLedger Continuity Centre should group owed medicines by patient in a single-open style card.",
);
assertPresent(
  app,
  /const canCompleteSale =[\s\S]*isSuperAdmin\(db, currentUser\)[\s\S]*currentUser\.role === "pharmacist"[\s\S]*currentUser\.role === "cashier"/,
  "RxLedger POS completion should allow super admin, assigned pharmacists, and cashiers.",
);
assertPresent(
  `${app}\n${notificationsComponent}`,
  /receivedStock[\s\S]*ReceivedStockModal[\s\S]*Close notification/s,
  "RxLedger received-medication notifications should open a received-items modal before dismissal.",
);
assertPresent(
  action,
  /case "updatePatientProfile"[\s\S]*updatePatientProfile[\s\S]*Updated patient profile/,
  "RxLedger should support audited patient profile corrections.",
);
assertPresent(
  `${app}\n${patientProfilePanel}`,
  /Edit profile/,
  "RxLedger patient profiles should be editable from the Patients page.",
);
assertPresent(
  app,
  /updatePatientProfile[\s\S]*Patient profile updated/,
  "RxLedger patient edit form should call the patient profile update action.",
);
assertPresent(
  `${app}\n${patientProfilePanel}`,
  /groupSalesByDate[\s\S]*selectedFollowUpMessage[\s\S]*patient-history-day[\s\S]*followUpCard/s,
  "RxLedger patient history should group same-day visits and show only the selected sale follow-up message.",
);
assertPresent(
  blueprint,
  /Saved patient profiles can be corrected[\s\S]*sales[\s\S]*continuity requests/,
  "RxLedger blueprint should document editable patient profile corrections.",
);

assertPresent(
  shared,
  /CREATE TABLE IF NOT EXISTS tenant_state[\s\S]*slug TEXT PRIMARY KEY[\s\S]*data JSONB NOT NULL/,
  "RxLedger should persist each workspace in a tenant-scoped row instead of keeping hot-path state in one all-tenant document.",
);
assertPresent(
  shared,
  /INSERT INTO tenant_state[\s\S]*jsonb_array_elements[\s\S]*ON CONFLICT \(slug\) DO NOTHING/,
  "RxLedger should migrate existing root workspaces into tenant-scoped storage without overwriting newer tenant data.",
);
assertPresent(
  shared,
  /loadTenantDatabase[\s\S]*SELECT data[\s\S]*FROM tenant_state[\s\S]*WHERE slug =/,
  "Tenant state loads should query only the requested workspace.",
);
assertPresent(
  shared,
  /saveTenantDatabase[\s\S]*INSERT INTO tenant_state[\s\S]*ON CONFLICT \(slug\)[\s\S]*DO UPDATE SET data/,
  "Tenant state saves should update only the requested workspace row.",
);
assertAbsent(
  bootstrap,
  /saveRootState\(root\)/,
  "Bootstrap must not rewrite the complete workspace root during a read-only page load.",
);
assertPresent(
  `${bootstrap}\n${shared}`,
  /loadTenantBootstrap[\s\S]*data->'settings'[\s\S]*jsonb_array_length/,
  "Bootstrap should query only workspace settings and user count, not deserialize operational history.",
);
for (const [source, route] of [
  [state, "/api/state"],
  [action, "/api/action"],
]) {
  assertPresent(
    source,
    new RegExp(`logApiPerformance[\\s\\S]*${route.replace("/", "\\/")}`),
    `${route} should emit structured timing and response-size telemetry.`,
  );
}
assertPresent(
  action,
  /snapshotHeavyCollections[\s\S]*buildDatabasePatch[\s\S]*stripHeavyCollections/,
  "Actions should return deltas for large historical collections instead of resending complete history.",
);
assertPresent(
  `${api}\n${app}\n${databasePatch}`,
  /databasePatch[\s\S]*applyDatabasePatch/,
  "The client should merge action deltas into its existing workspace state.",
);
assertPresent(
  state,
  /clean\.auditLogs = \[\]/,
  "Initial state should defer the global-admin audit archive.",
);
assertPresent(
  `${api}\n${app}\n${state}`,
  /loadAuditHistory[\s\S]*auditHistoryLoaded[\s\S]*canAdmin/,
  "Historical audit records should load only when the global admin opens Audit.",
);
assertPresent(
  state,
  /scope === "sales"[\s\S]*loadTenantSalesPage[\s\S]*res\.status\(200\)\.json\(page\)/,
  "Sales history should load through a paginated state scope instead of the initial workspace payload.",
);
assertPresent(
  state,
  /clean\.sales = \[\]/,
  "Initial authenticated state should defer historical sales so large workspaces paint faster.",
);
assertPresent(
  login,
  /clean\.sales = \[\]/,
  "Login responses should also defer historical sales for large workspaces.",
);
assertPresent(
  `${api}\n${app}`,
  /loadSalesHistory[\s\S]*salesHistoryLoaded[\s\S]*hydrateSalesHistory/s,
  "The client should hydrate sales history only when a history-aware view needs it.",
);
assertPresent(
  shared,
  /loadTenantSalesPage[\s\S]*data->'sales'[\s\S]*LIMIT \$\{queryLimit\}[\s\S]*nextCursor/s,
  "Tenant sales history should be read from the sales JSONB slice with a bounded page size.",
);
assertPresent(
  types,
  /stockSnapshot: StockSnapshotEntry\[\][\s\S]*ledgerSummary: LedgerSummary/,
  "RxLedger state should include compact stock and ledger read models for fast initial paint.",
);
assertPresent(
  shared,
  /withReadModels[\s\S]*buildStockSnapshot[\s\S]*buildLedgerSummary/s,
  "Server responses should refresh derived stock and ledger summaries from the authoritative ledger.",
);
assertPresent(
  state,
  /scope === "ledger"[\s\S]*loadTenantLedgerPage[\s\S]*res\.status\(200\)\.json\(page\)/,
  "Movement ledger history should load through a paginated state scope.",
);
assertPresent(
  `${state}\n${login}`,
  /clean\.ledger = \[\]/,
  "Initial authenticated state and login should defer historical ledger entries.",
);
assertPresent(
  `${api}\n${app}`,
  /loadLedgerHistory[\s\S]*ledgerHistoryLoaded[\s\S]*hydrateLedgerHistory/s,
  "The client should hydrate ledger history only when movement/report views need it.",
);
assertPresent(
  app,
  /getStockRows[\s\S]*db\.stockSnapshot[\s\S]*snapshotQuantities/,
  "Client stock rows should prefer the compact stock snapshot before full ledger history.",
);
assertPresent(
  app,
  /getStockRows[\s\S]*medicinesById[\s\S]*suppliersById[\s\S]*branchesById/s,
  "Client stock rows should use cached ID maps instead of repeated catalog lookups.",
);
assertPresent(
  app,
  /todayMovements[\s\S]*db\.ledgerSummary\.todayMovementCountsByBatchId/,
  "Dashboard movement count should prefer the compact ledger summary before full ledger history.",
);
assertPresent(
  app,
  /function Reports[\s\S]*salesByReference[\s\S]*branchNameById[\s\S]*suppliersById/s,
  "Reports should use cached lookup maps for high-volume movement and receiving history.",
);

console.log("RxLedger rule regression tests passed.");
