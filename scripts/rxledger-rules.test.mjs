import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const app = read("src/App.tsx");
const action = read("api/action.ts");
const api = read("src/api.ts");
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
  /const canCompleteSale = currentUser\.role === "cashier"/,
  "RxLedger sale completion should remain cashier-controlled.",
);
assertPresent(
  action,
  /Only cashiers can complete POS sales/,
  "RxLedger backend should enforce cashier-only POS completion.",
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

for (const source of [app, action, shared, types]) {
  assertAbsent(
    source,
    /Pending medication|pendingMedications|Medication Owed|Backorder Log/i,
    "RxLedger should not receive the Pharmacy Inventory-only pending medication flow through these tests.",
  );
}

assertPresent(
  app,
  /ContinuityCentre[\s\S]*Action queue, not alert flood/,
  "RxLedger should keep Continuity Centre as a calm action queue.",
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

console.log("RxLedger rule regression tests passed.");
