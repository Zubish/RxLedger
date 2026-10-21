import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

test("emitted server modules load with real relative dependencies and initialize the alert read model", () => {
  const root = mkdtempSync(join(tmpdir(), "rxledger-server-artifact-"));
  try {
    symlinkSync(resolve("node_modules"), join(root, "node_modules"), "dir");
    for (const file of [
      "src/alertPolicy.ts",
      "src/financial.ts",
      "src/accessPolicy.ts",
      "src/dataAccess.ts",
      "server/staff-access.ts",
      "src/patientRegistry.ts",
      "server/patient-registry.ts",
      "src/workspaceIdentity.ts",
      "src/databasePatch.ts",
      "server/branch-scope.ts",
      "server/_shared.ts",
      "api/action.ts",
      "server/financial-report.ts",
      "api/bootstrap.ts",
    ]) {
      const destination = join(root, file.replace(/\.ts$/, ".js"));
      mkdirSync(dirname(destination), { recursive: true });
      const emitted = ts.transpileModule(readFileSync(file, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText;
      writeFileSync(destination, emitted);
    }
    const require = createRequire(join(root, "package.json"));
    const shared = require(join(root, "server/_shared.js"));
    assert.equal(typeof require(join(root, "server/financial-report.js")).default,"function");
    const normalized = shared.normalizeDatabase(shared.createEmptyDatabase());
    assert.deepEqual(normalized.alertPreferences, []);
    assert.equal(shared.getCompanySlugFromRequest({ headers: { "x-rxledger-company": "demo" } }), "totalenergies-pharmacy");
    const identity = require(join(root, "src/workspaceIdentity.js"));
    assert.equal(identity.publicWorkspaceSlug("totalenergies-pharmacy"), "demo");
    assert.equal(identity.tenantWorkspaceSlug("zionett-pharmacy"), "zionett-pharmacy");
    assert.equal(
      typeof require(join(root, "api/action.js")).default,
      "function",
    );
    assert.equal(
      typeof require(join(root, "api/bootstrap.js")).default,
      "function",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
