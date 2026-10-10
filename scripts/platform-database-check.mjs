// Optional isolated-branch integration check. Never points at production.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { resolve } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { neon, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
neonConfig.webSocketConstructor = class extends WebSocket {
  constructor(url, protocols) {
    super(url, protocols, {
      agent: new HttpsProxyAgent(process.env.HTTPS_PROXY),
    });
  }
};
import { createOTP } from "@better-auth/utils/otp";
const require = createRequire(resolve("package.json"));
const ts = require("typescript");
const connection = JSON.parse(
  readFileSync("/tmp/rxledger-platform/test-connection.json", "utf8"),
);
assert.equal(new URL(connection).hostname,"ep-polished-feather-apx3c2ii-pooler.c-7.us-east-1.aws.neon.tech","This check is restricted to the isolated integration branch");
process.env.RXLEDGER_APP_ORIGIN = "http://localhost:5173";
const sql = neon(connection);
const shared = {
  getSql: () => sql,
  getConnectionString: () => connection,
  getCompanySlugFromRequest: (req) => req.headers["x-rxledger-company"],
};
function load(file, deps = {}) {
  const filename = resolve(file);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(resolve("server/platform"));
  mod.require = (name) => (name in deps ? deps[name] : require(name));
  mod._compile(
    ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    filename,
  );
  return mod.exports;
}
const options = load("server/platform/auth-options.ts", { ws: neonConfig.webSocketConstructor });
const auth = load("server/platform/auth.ts", {
  "./auth-options.js": options,
  "../_shared.js": shared,
});
const report = load("server/platform/report.ts", { "../_shared.js": shared });
const maintenance = { maintainPlatformTelemetry: async () => {} };
const handler = load("server/platform/handler.ts", {
  "./auth.js": auth,
  "./report.js": report,
  "./maintenance.js": maintenance,
  "../_shared.js": shared,
}).default;
const authHandler = load("server/platform/auth-handler.ts", {
  "./auth.js": auth,
  "../_shared.js": shared,
}).default;
let cookie = "";
let userId;
const invite = randomBytes(32).toString("hex");
const hash = createHash("sha256").update(invite).digest("hex");
const password = randomBytes(24).toString("hex");
const eventIds = Array.from({ length: 6 }, () =>
  randomBytes(16).toString("hex"),
);
async function invoke(fn, query, body) {
  let code = 200;
  let json;
  const res = {
    setHeader: (k, v) => {
      if (k === "Set-Cookie") {
        const map = new Map(
          cookie
            .split("; ")
            .filter(Boolean)
            .map((p) => {
              const [k, ...v] = p.split("=");
              return [k, v.join("=")];
            }),
        );
        for (const value of Array.isArray(v) ? v : [v]) {
          const [k, ...val] = value.split(";")[0].split("=");
          map.set(k, val.join("="));
        }
        cookie = [...map].map(([k, v]) => k + "=" + v).join("; ");
      }
    },
    status(n) {
      code = n;
      return this;
    },
    json(value) {
      json = value;
    },
    end() {},
  };
  await fn(
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin: "http://localhost:5173",
        cookie,
        "content-type": "application/json",
        "x-vercel-forwarded-for": "127.0.0.1",
      },
      query,
      body,
    },
    res,
  );
  return { code, json };
}
try {
  const guard = await sql.query(
    "SELECT count(*)::int owners FROM platform_owners",
    [],
  );
  assert.equal(guard[0].owners, 0, "Use a clean isolated platform branch");
  for (const col of ["load_ms", "auth_ms", "save_ms"])
    await sql.query(
      "ALTER TABLE platform_events ADD COLUMN IF NOT EXISTS " +
        col +
        " double precision",
      [],
    );
  for (const col of ["activated_at", "last_activity"])
    await sql.query(
      "ALTER TABLE platform_workspace_meta ADD COLUMN IF NOT EXISTS " +
        col +
        " timestamptz",
      [],
    );
  await sql.query(
    "INSERT INTO platform_invites(token_hash,expires_at) VALUES($1,now()+interval '1 hour')",
    [hash],
  );
  const enrolled = await invoke(
    handler,
    { mode: "enroll" },
    {
      token: invite,
      email: "integration-owner@example.test",
      name: "Integration owner",
      password,
    },
  );
  assert.equal(enrolled.code, 200, JSON.stringify(enrolled.json));
  const found = await sql.query(
    "SELECT id FROM platform_auth_user WHERE email=$1",
    ["integration-owner@example.test"],
  );
  userId = found[0].id;
  assert.equal((await invoke(handler, { mode: "report" })).code, 401);
  const setup = await invoke(
    authHandler,
    { authRoute: "two-factor/enable" },
    { password },
  );
  assert.equal(setup.code, 200, JSON.stringify(setup.json));
  const secret = new URL(setup.json.totpURI).searchParams.get("secret");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret)
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const raw = Buffer.from(
    bits.match(/.{8}/g).map((b) => parseInt(b, 2)),
  ).toString();
  const code = await createOTP(raw).totp();
  const verified = await invoke(
    authHandler,
    { authRoute: "two-factor/verify-totp" },
    { code },
  );
  assert.equal(verified.code, 200, JSON.stringify(verified.json));
  assert.equal(
    (await invoke(handler, { mode: "status" })).json.authenticated,
    true,
  );
  assert.equal(
    (
      await invoke(
        authHandler,
        { authRoute: "two-factor/enable" },
        { password },
      )
    ).code,
    403,
    "An existing authenticator cannot be reset using a password-only session",
  );
  const initial = await invoke(handler, { mode: "report" });
  assert.equal(initial.code, 200, JSON.stringify(initial.json));
  assert.equal(initial.json.counts.total, 1);
  assert.equal(initial.json.counts.demo, 1);
  for (let i = 0; i < 5; i++)
    await sql.query(
      "INSERT INTO platform_events(id,workspace,kind,event,route,status,duration,bytes) VALUES($1,'totalenergies-pharmacy','demo','api','/api/state',$2,$3,100)",
      [eventIds[i], i === 4 ? 500 : 200, (i + 1) * 100],
    );
  await sql.query(
    "INSERT INTO platform_events(id,workspace,kind,event,page) VALUES($1,'totalenergies-pharmacy','demo','page_visit','pos') ON CONFLICT DO NOTHING",
    [eventIds[5]],
  );
  await sql.query(
    "INSERT INTO platform_events(id,workspace,kind,event,page) VALUES($1,'totalenergies-pharmacy','demo','page_visit','pos') ON CONFLICT DO NOTHING",
    [eventIds[5]],
  );
  const excluded = await report.platformReport(new URLSearchParams("days=7"));
  assert.equal(excluded.counts.active, 0);
  assert.equal(excluded.health.samples, 0);
  const included = await report.platformReport(
    new URLSearchParams("days=7&demo=true"),
  );
  assert.equal(included.health.samples, 5);
  assert.equal(included.health.failures, 1);
  assert.equal(included.health.routes[0].p50, 300);
  assert.equal(included.health.p95, 480);
  assert.equal(included.usage[0].visits, 1);
  assert.equal(included.counts.active, 1);
  assert.equal(included.health.availability.percentage, null);
  assert.equal(included.workspacePage.rows[0].name, "DEMO");
  await invoke(authHandler, { authRoute: "sign-out" }, {});
  assert.equal((await invoke(handler, { mode: "report" })).code, 401);
  console.log(
    "Isolated database integration passed: enrollment, MFA enforcement, SQL aggregates, percentiles, DEMO exclusion and deduplication",
  );
} finally {
  await sql.query("DELETE FROM platform_events WHERE id=ANY($1::text[])", [
    eventIds,
  ]);
  await sql.query("DELETE FROM platform_invites WHERE token_hash=$1", [hash]);
  if (userId)
    await sql.query("DELETE FROM platform_auth_user WHERE id=$1", [userId]);
  const instance = await auth.getPlatformAuth();
  await (await instance.$context).options.database.end();
}
