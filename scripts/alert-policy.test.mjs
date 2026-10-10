import assert from "node:assert/strict";
import test from "node:test";
import {
  eventAlertKey,
  ALERT_REMINDER_MS,
  alertDisposition,
  inventoryAlerts,
  reconcileAlertPreferences,
} from "../src/alertPolicy.ts";
import { scopeDatabaseForUser } from "../server/branch-scope.ts";
import fixture from "./fixtures/ux-database.mjs";
const now = Date.parse("2026-10-10T12:00:00Z");
const pref = (key, mode = "snoozed") => ({
  userId: "staff",
  key,
  branchId: "a",
  mode,
  clearedAt: new Date(now).toISOString(),
});
function inventory() {
  return {
    medicines: [
      {
        id: "m",
        brandName: "Medicine",
        genericName: "",
        active: true,
        reorderLevel: 10,
        unit: "pack",
        sellableUnit: "tablet",
      },
    ],
    branches: [
      { id: "a", name: "Central", active: true },
      { id: "b", name: "Other", active: true },
    ],
    batches: [
      {
        id: "batch",
        medicineId: "m",
        branchId: "a",
        expiryDate: "2028-01-01",
        batchNumber: "B",
        location: "Shelf",
      },
    ],
    stockSnapshot: [{ batchId: "batch", quantity: 5 }],
    settings: { nearExpiryDays: 90 },
  };
}
test("cleared issues return exactly seven days later; muted issues never auto-return", () => {
  assert.equal(
    alertDisposition("low:a:m", [pref("low:a:m")], now + ALERT_REMINDER_MS - 1),
    "snoozed",
  );
  assert.equal(
    alertDisposition("low:a:m", [pref("low:a:m")], now + ALERT_REMINDER_MS),
    "active",
  );
  assert.equal(
    alertDisposition(
      "low:a:m",
      [pref("low:a:m", "muted")],
      now + 100 * ALERT_REMINDER_MS,
    ),
    "muted",
  );
  assert.equal(
    alertDisposition("low:a:new", [pref("low:a:m", "muted")], now),
    "active",
  );
});
test("alert identities are branch specific and include zero-stock medicines without batches", () => {
  const alerts = inventoryAlerts(inventory(), now);
  assert.deepEqual(
    alerts.map((a) => a.id),
    ["low:a:m", "out:b:m"],
  );
  assert.match(alerts[0].detail, /5 tablet/);
});
test("restocking resolves suppression, allowing a later shortage to appear immediately", () => {
  let db = { ...inventory(), alertPreferences: [pref("low:a:m", "muted")] };
  db.stockSnapshot[0].quantity = 11;
  db = reconcileAlertPreferences(db, now);
  assert.deepEqual(db.alertPreferences, []);
  db.stockSnapshot[0].quantity = 3;
  assert.equal(
    alertDisposition(inventoryAlerts(db, now)[0].id, db.alertPreferences, now),
    "active",
  );
});
test("escalation to out of stock or expired is a fresh issue even if earlier warning was muted", () => {
  const db = {
    ...inventory(),
    alertPreferences: [pref("low:a:m", "muted"), pref("near:a:batch", "muted")],
  };
  db.batches[0].expiryDate = "2026-10-09";
  const expired = inventoryAlerts(db, now).find((a) => a.kind === "expired");
  assert.equal(
    alertDisposition(expired.id, db.alertPreferences, now),
    "active",
  );
  db.stockSnapshot[0].quantity = 0;
  const resolved = reconcileAlertPreferences(db, now);
  assert.deepEqual(resolved.alertPreferences, []);
  assert.ok(inventoryAlerts(resolved, now).some((a) => a.id === "out:a:m"));
});
test("group clearing affects only the captured items, never new medicines", () => {
  const db = inventory();
  const captured = inventoryAlerts(db, now).map((a) => pref(a.id));
  db.medicines.push({ ...db.medicines[0], id: "new" });
  assert.equal(alertDisposition("out:a:new", captured, now), "active");
});
test("users receive only their own alert preferences in authorized branches, including global admins", () => {
  const db = structuredClone(fixture);
  db.alertPreferences = [
    pref("low:a:m"),
    { ...pref("low:b:m"), branchId: "b" },
    { ...pref("low:a:other"), userId: "other" },
    { ...pref("low:a:admin"), userId: "admin" },
  ];
  assert.deepEqual(
    scopeDatabaseForUser(db, db.users[1]).alertPreferences.map((p) => p.key),
    ["low:a:m"],
  );
  assert.deepEqual(
    scopeDatabaseForUser(db, db.users[0]).alertPreferences.map((p) => p.key),
    ["low:a:admin"],
  );
  assert.deepEqual(
    scopeDatabaseForUser(db, {
      ...db.users[1],
      branchAccessExpiresAt: { a: "2000-01-01" },
    }).alertPreferences,
    [],
  );
});

// Run the real API handler with an isolated in-memory tenant and session.
const { Module, createRequire } = await import("node:module");
const { readFileSync } = await import("node:fs");
const { resolve } = await import("node:path");
const scope = await import("../server/branch-scope.ts");
const patches = await import("../src/databasePatch.ts");
const require = createRequire(resolve("package.json"));
const ts = require("typescript");
const actionModule = new Module(resolve("api/action.ts"));
let stored,
  saves = 0;
actionModule.require = (name) => {
  if (name.endsWith("alertPolicy.js")) return { inventoryAlerts };
  if (name.endsWith("branch-scope.js")) return scope;
  if (name.endsWith("databasePatch.js")) return patches;
  if (name.endsWith("_shared.js"))
    return {
      trackApi() {},
      requireMethod: () => true,
      getCompanySlugFromRequest: () => "test",
      loadTenantDatabase: async () => structuredClone(stored),
      getAuthenticatedUser: async () => stored.users[1],
      nowIso: () => new Date(now).toISOString(),
      addAudit() {},
      withReadModels: (db) => reconcileAlertPreferences(db, now),
      saveTenantDatabase: async (slug, db) => {
        stored = structuredClone(db);
        saves++;
      },
      sanitizeDatabase: (db) => db,
      jsonByteLength: () => 0,
      setServerTiming() {},
      logApiPerformance() {},
      fail: (res, status, error) => res.status(status).json({ error }),
    };
  throw Error(name);
};
actionModule._compile(
  ts.transpileModule(readFileSync("api/action.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  resolve("api/action.ts"),
);
async function action(alerts, mode) {
  let status, body;
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(data) {
      body = data;
    },
  };
  await actionModule.exports.default(
    { body: { action: "setAlertPreferences", payload: { alerts, mode } } },
    res,
  );
  return { status, body };
}
test("API persists per-user preferences, derives branch, restores only own items, and rejects foreign targets atomically", async () => {
  stored = structuredClone(fixture);
  saves = 0;
  stored.alertPreferences = [{ ...pref("out:a:m2", "muted"), userId: "admin" }];
  let result = await action([{ key: "out:a:m2" }], "snoozed");
  assert.equal(result.status, 200);
  assert.equal(
    stored.alertPreferences.find((p) => p.userId === "staff").branchId,
    "a",
  );
  assert.deepEqual(
    result.body.db.alertPreferences.map((p) => p.userId),
    ["staff"],
  );
  assert.equal(saves, 1);
  result = await action(
    [{ key: "out:a:m2" }, { key: "out:b:m2", branchId: "b" }],
    "muted",
  );
  assert.equal(result.status, 400);
  assert.equal(saves, 1);
  assert.equal(
    stored.alertPreferences.find((p) => p.userId === "staff").mode,
    "snoozed",
  );
  result = await action([{ key: "out:a:m2" }], "restore");
  assert.equal(result.status, 200);
  assert.deepEqual(
    stored.alertPreferences.map((p) => p.userId),
    ["admin"],
  );
  assert.equal((await action([{ key: "invalid:key" }], "muted")).status, 400);
});

test("matching event timestamps in separate branches never share suppression", () => {
  const a = eventAlertKey(
    "continuity-matched",
    "a",
    new Date(now).toISOString(),
  );
  const b = eventAlertKey(
    "continuity-matched",
    "b",
    new Date(now).toISOString(),
  );
  assert.equal(alertDisposition(b, [pref(a, "muted")], now), "active");
});
