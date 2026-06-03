import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const app = read("src/App.tsx");
const action = read("api/action.ts");
const shared = read("api/_shared.ts");
const types = read("src/types.ts");

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

for (const source of [app, action, shared, types]) {
  assertAbsent(
    source,
    /Pending medication|pendingMedications|Medication Owed|Backorder Log/i,
    "RxLedger should not receive the Pharmacy Inventory-only pending medication flow through these tests.",
  );
}

console.log("RxLedger rule regression tests passed.");
