import test from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { twoFactor } from "better-auth/plugins/two-factor";
import { createOTP } from "@better-auth/utils/otp";
import { readFileSync } from "node:fs";
import { Module, createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(resolve("package.json"));
const ts = require("typescript");
function load(file, dependencies = {}) {
  const filename = resolve(file);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(resolve("server/platform"));
  mod.require = (name) =>
    name in dependencies ? dependencies[name] : require(name);
  mod._compile(
    ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    filename,
  );
  return mod.exports;
}
const contracts = load("src/platform/contracts.ts");
const { validateBrowserEvent } = load("server/platform/event-validation.ts", {
  "../../src/platform/contracts.js": contracts,
});
test("browser telemetry rejects patient content, raw queries, invalid metrics and arbitrary pages", () => {
  const good = {
    id: "abcdef0123456789abcdef0123456789",
    event: "page_visit",
    page: "patients",
    device: "mobile",
  };
  assert.ok(validateBrowserEvent(good));
  for (const extra of [
    { patientName: "private" },
    { url: "/?token=private" },
    { body: {} },
    { page: "arbitrary" },
    { event: "web_vital", vital: "LCP", value: Infinity },
    { event: "browser_error", group: "patient-name" },
  ])
    assert.equal(validateBrowserEvent({ ...good, ...extra }), null);
});
test("server requires separate owner membership and a live MFA proof for reporting", async () => {
  let session = {
    user: { id: "owner", twoFactorEnabled: true },
    session: { id: "session" },
  };
  let rows = [];
  const fakeAuth = { api: { getSession: async () => session } };
  const { requireOwner, ownerStatus } = load("server/platform/auth.ts", {
    "better-auth": { betterAuth: () => fakeAuth },
    "./auth-options.js": { platformAuthOptions: () => ({}) },
    "../_shared.js": {
      getConnectionString: () => "",
      getSql: () => ({
        query: async (sql) =>
          sql.includes("auth_secret") ? [{ auth_secret: "test" }] : rows,
      }),
    },
  });
  const req = { headers: {} };
  await assert.rejects(requireOwner(req), /PLATFORM_UNAUTHORIZED/);
  rows = [{ user_id: "owner", session_id: null }];
  assert.equal((await ownerStatus(req)).mfaVerified, false);
  await assert.rejects(requireOwner(req), /PLATFORM_UNAUTHORIZED/);
  rows = [{ user_id: "owner", session_id: "session" }];
  assert.ok(await requireOwner(req));
  session.user.twoFactorEnabled = false;
  await assert.rejects(requireOwner(req), /PLATFORM_UNAUTHORIZED/);
  session = null;
  await assert.rejects(requireOwner(req), /PLATFORM_UNAUTHORIZED/);
});
test("real Better Auth enrollment, TOTP and subsequent sign-in challenge work without trusting devices", async () => {
  const db = {
    user: [],
    session: [],
    account: [],
    verification: [],
    twoFactor: [],
  };
  const auth = betterAuth({
    baseURL: "http://localhost:5173",
    basePath: "/api/platform-auth",
    secret: "test-only-secret-with-more-than-thirty-two-characters",
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true, minPasswordLength: 12 },
    advanced: { cookiePrefix: "rxledger_platform" },
    plugins: [twoFactor({ issuer: "RxLedger Platform" })],
  });
  let cookies = new Map();
  const headers = () =>
    new Headers({
      origin: "http://localhost:5173",
      cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "),
    });
  async function call(path, body) {
    const res = await auth.handler(
      new Request("http://localhost:5173/api/platform-auth/" + path, {
        method: "POST",
        headers: new Headers({
          ...Object.fromEntries(headers()),
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(body),
      }),
    );
    for (const cookie of res.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const [k, ...v] = pair.split("=");
      cookies.set(k, v.join("="));
    }
    const result = await res.json();
    assert.equal(res.status, 200, JSON.stringify(result));
    return result;
  }
  await call("sign-up/email", {
    email: "owner@example.test",
    password: "a-test-password-123456",
    name: "Test owner",
  });
  const setup = await call("two-factor/enable", {
    password: "a-test-password-123456",
  });
  assert.equal(setup.backupCodes.length, 10);
  const secret = new URL(setup.totpURI).searchParams.get("secret");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret)
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = bits.match(/.{8}/g).map((b) => parseInt(b, 2));
  const code = await createOTP(Buffer.from(bytes).toString()).totp();
  await call("two-factor/verify-totp", { code });
  let session = await auth.api.getSession({ headers: headers() });
  assert.equal(session.user.twoFactorEnabled, true);
  await call("sign-out", {});
  const login = await call("sign-in/email", {
    email: "owner@example.test",
    password: "a-test-password-123456",
  });
  assert.equal(login.twoFactorRedirect, true);
  assert.equal(await auth.api.getSession({ headers: headers() }), null);
  await call("two-factor/verify-backup-code", { code: setup.backupCodes[0] });
  session = await auth.api.getSession({ headers: headers() });
  assert.ok(session);
  assert.ok(![...cookies.keys()].some((k) => k.includes("trust_device")));
});

test("auth proxy denies public signup, MFA reset, trusted devices and cross-origin mutations", async () => {
  const calls = [];
  const handler = load("server/platform/auth-handler.ts", {
    "./auth.js": {
      trustedMutation: (req) =>
        req.headers.origin === "https://rxledger.vercel.app",
      ownerStatus: async () => ({
        session: { user: { twoFactorEnabled: true } },
      }),
      getPlatformAuth: () => {
        calls.push("unexpected");
        throw new Error("unexpected");
      },
    },
    "../_shared.js": { getSql: () => ({}) },
  }).default;
  for (const [route, origin, body, expected] of [
    ["sign-up/email", "https://rxledger.vercel.app", {}, 404],
    ["two-factor/disable", "https://rxledger.vercel.app", {}, 404],
    ["two-factor/enable", "https://rxledger.vercel.app", {}, 403],
    [
      "two-factor/verify-totp",
      "https://rxledger.vercel.app",
      { trustDevice: true },
      400,
    ],
    ["sign-in/email", "https://untrusted.example", {}, 403],
  ]) {
    let code;
    const res = {
      setHeader() {},
      status(n) {
        code = n;
        return this;
      },
      json() {},
    };
    await handler(
      {
        method: "POST",
        headers: { origin },
        query: { authRoute: route },
        body,
      },
      res,
    );
    assert.equal(code, expected);
  }
  assert.deepEqual(calls, []);
});

test('collector sends the established workspace header and stops after logout', async()=>{
 const previous={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch};const requests=[];const listeners=[];const callbacks=[];
 globalThis.window={innerWidth:390,addEventListener:(_name,callback)=>listeners.push(callback)};globalThis.document={visibilityState:'visible'};globalThis.fetch=async(url,options)=>{requests.push({url,options});return {};};
 try{const collector=load('src/platform/collect.ts',{'web-vitals':{onCLS:fn=>callbacks.push(fn),onINP:fn=>callbacks.push(fn),onLCP:fn=>callbacks.push(fn)}});collector.collectPage('totalenergies-pharmacy','patients');assert.equal(requests[0].options.headers['x-rxledger-company'],'totalenergies-pharmacy');const event=JSON.parse(requests[0].options.body);assert.ok(validateBrowserEvent(event));assert.equal(event.page,'patients');callbacks[0]({id:'v6-123456789-123456789',name:'CLS',value:0.01});callbacks[0]({id:'v6-123456789-123456789',name:'CLS',value:0.02});assert.equal(JSON.parse(requests[1].options.body).id,JSON.parse(requests[2].options.body).id);collector.stopCollection();for(const callback of listeners)callback();assert.equal(requests.length,3);}finally{for(const [key,value] of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('deployment dispatcher preserves prototype-backed Vercel request headers',()=>{
 const calls=[];const handler=load('api/rai.ts',{'../server/rai/analytics-snapshot.js':()=>{},'../server/rai/connection.js':()=>{},'../server/rai/router.js':{createRaiRouter:()=>()=>{}},'../server/platform/handler.js':req=>calls.push(req),'../server/platform/auth-handler.js':req=>calls.push(req),'../server/platform/telemetry-handler.js':req=>calls.push(req)}).default;
 const headers={origin:'https://rxledger.vercel.app',cookie:'synthetic'};for(const route of ['platform','platform-auth','telemetry']){const req=Object.create({get headers(){return headers;}});req.method='POST';req.body={};req.query={route};handler(req,{});assert.equal(calls.at(-1).headers,headers);assert.equal(calls.at(-1).method,'POST');assert.equal(calls.at(-1).body,req.body);}
});
