import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const base = process.env.RXLEDGER_AUDIT_URL || "http://localhost:5173";
await mkdir("artifacts/platform-admin", { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  measurementStartedAt: new Date().toISOString(),
  release: "test-release",
  days: 7,
  includeDemo: false,
  counts: {
    total: 1,
    pharmacy: 0,
    demo: 1,
    internal: 0,
    newPharmacies: 0,
    active: 0,
    activated: 0,
  },
  workspacePage: {
    rows: [
      {
        slug: "totalenergies-pharmacy",
        name: "DEMO",
        kind: "demo",
        createdAt: new Date().toISOString(),
        branches: 2,
        activeStaff: 4,
        lastActivity: null,
        activated: false,
        visits: 0,
        operations: 0,
      },
    ],
    total: 1,
    page: 1,
    limit: 25,
  },
  usage: [],
  daily: [],
  health: {
    routes: [],
    samples: 0,
    failures: 0,
    p95: null,
    devices: [],
    errors: [],
    availability: {
      expected: 2,
      observed: 0,
      successes: 0,
      missing: 2,
      percentage: null,
    },
  },
};
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
    });
    let authorized = true;
    await context.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      const mode = url.searchParams.get("mode");
      await route.fulfill({
        json:
          mode === "status"
            ? { authenticated: authorized }
            : mode === "report"
              ? report
              : { ok: true },
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/platform-admin#/overview");
    await page
      .getByRole("heading", { name: "Explore your platform" })
      .waitFor();
    for (const name of ["Workspaces", "Usage", "Health", "Overview"]) {
      await page
        .getByRole("navigation")
        .getByRole("button", { name, exact: true })
        .click();
      await page
        .getByRole("heading", { name, exact: true, level: 1 })
        .waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "overflow " + width + " " + name,
      );
    }
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Workspaces", exact: true })
      .click();
    await page.getByRole("button", { name: /DEMO.*totalenergies/ }).click();
    await page.getByRole("heading", { name: "DEMO", exact: true }).waitFor();
    assert.match(page.url(), /workspace=totalenergies-pharmacy/);
    await page.reload();
    await page.getByRole("heading", { name: "DEMO", exact: true }).waitFor();
    await page.goBack();
    await page.getByRole("heading", { name: /Workspace directory/ }).waitFor();
    await page.goForward();
    await page.getByRole("heading", { name: "DEMO", exact: true }).waitFor();
    await page.getByRole("button", { name: "Close details" }).click();
    await page.screenshot({
      path: "artifacts/platform-admin/directory-" + width + ".png",
      fullPage: true,
    });
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Health", exact: true })
      .click();
    await page
      .getByText("Monitoring is incomplete.", { exact: false })
      .waitFor();
    await page.screenshot({
      path: "artifacts/platform-admin/health-" + width + ".png",
      fullPage: true,
    });
    authorized = false;
    await page.reload();
    await page.getByRole("heading", { name: "Owner sign in" }).waitFor();
    assert.equal(await page.getByRole("navigation").count(), 0);
    assert.deepEqual(errors, []);
    console.log("Platform browser passed", width);
    await context.close();
  }
} finally {
  await browser.close();
}
