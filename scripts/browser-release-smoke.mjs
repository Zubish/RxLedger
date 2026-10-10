import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.RXLEDGER_RELEASE_URL || "https://rxledger.vercel.app";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
  proxy: process.env.HTTPS_PROXY
    ? { server: process.env.HTTPS_PROXY }
    : undefined,
});
try {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto(base);
  assert.equal(response.status(), 200);
  await page
    .getByRole("button", { name: /Start 30 days free trial/i })
    .or(page.getByRole("link", { name: /Start 30 days free trial/i }))
    .first()
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  const headers = { "X-RxLedger-Company": "totalenergies-pharmacy" };
  const bootstrap = await context.request.get(base + "/api/bootstrap", {
    headers,
  });
  assert.equal(bootstrap.status(), 200);
  assert.equal((await bootstrap.json()).tenantExists, true);
  const action = await context.request.post(base + "/api/action", {
    headers,
    data: {
      action: "setAlertPreferences",
      payload: { mode: "muted", alerts: [{ key: "out:unauthorized:fixture" }] },
    },
  });
  assert.equal(
    action.status(),
    401,
    "anonymous callers cannot change alert preferences",
  );
  await page.goto(base + "/totalenergies-pharmacy#/notifications");
  await page.waitForSelector('input[type="password"]');
  assert.equal(new URL(page.url()).hash, "#/notifications");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Production landing, DEMO bootstrap, anonymous mutation guard and requested-page login passed. No pharmacy data modified.",
  );
  await context.close();
} finally {
  await browser.close();
}
