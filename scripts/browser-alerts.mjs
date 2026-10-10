import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import fixture from "./fixtures/ux-database.mjs";
import {
  reconcileAlertPreferences,
  ALERT_REMINDER_MS,
} from "../src/alertPolicy.ts";
import { scopeDatabaseForUser } from "../server/branch-scope.ts";
const base = process.env.RXLEDGER_AUDIT_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
  proxy:
    base.startsWith("https:") && process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY }
      : undefined,
});
mkdirSync("artifacts/platform-admin", { recursive: true });
try {
  for (const width of process.argv.includes("--phone-only")
    ? [390]
    : [320, 390, 768, 1440]) {
    let db = structuredClone(fixture);
    for (const row of db.stockSnapshot)
      if (["m3a", "m4a"].includes(row.batchId)) row.quantity = 5;
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      ignoreHTTPSErrors: base.startsWith("https:"),
      isMobile: width < 500,
      hasTouch: width < 1000,
    });
    await context.addInitScript(() =>
      localStorage.setItem("rxledger-session-active", "true"),
    );
    await context.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/bootstrap")
        return route.fulfill({
          json: { hasUsers: true, tenantExists: true, settings: db.settings },
        });
      if (url.pathname === "/api/action") {
        const { action, payload } = route.request().postDataJSON();
        if (action === "setAlertPreferences") {
          const keys = new Set(payload.alerts.map((a) => a.key));
          db.alertPreferences = (db.alertPreferences || []).filter(
            (p) => p.userId !== "staff" || !keys.has(p.key),
          );
          if (payload.mode !== "restore")
            db.alertPreferences.push(
              ...payload.alerts.map((a) => ({
                ...a,
                userId: "staff",
                mode: payload.mode,
                clearedAt: new Date().toISOString(),
              })),
            );
        }
      }
      db = reconcileAlertPreferences(db);
      const body = {
        db: scopeDatabaseForUser(db, db.users[1]),
        currentUser: db.users[1],
      };
      if (url.pathname === "/api/action")
        body.databasePatch = Object.fromEntries(
          ["sales", "ledger", "auditLogs"].map((key) => [
            key,
            { upserts: [], removedIds: [] },
          ]),
        );
      await route.fulfill({ json: body });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/audit#/notifications");
    await page.waitForSelector(".grouped-alerts");
    const skip = page
      .locator(".quest-coach-head button")
      .filter({ hasText: "Skip" });
    if (await skip.isVisible()) await skip.click();
    const panel = page.locator(".content-section").filter({
      has: page.getByRole("heading", {
        name: "Notification Center",
        exact: true,
      }),
    });
    const low = panel
      .locator("details")
      .filter({ hasText: /Pharmacy items? below minimum stock/ });
    assert.equal(await low.count(), 1);
    assert.match(await low.locator("summary").innerText(), /2 Pharmacy items/);
    assert.equal(await low.getAttribute("open"), null);
    assert.equal(
      await panel.getByText("Riverside Branch", { exact: true }).count(),
      0,
    );
    await low.locator("summary").click();
    await low
      .locator(".alert-detail-row")
      .first()
      .getByRole("button", { name: "Clear", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    assert.ok(
      await page
        .getByText("Unresolved alerts will return in 7 days", { exact: false })
        .isVisible(),
    );
    assert.ok(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    await page
      .getByRole("button", { name: "Remind me in 7 days", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await panel
      .getByRole("button", { name: "Cleared (1)", exact: true })
      .click();
    await page.reload();
    await page.waitForSelector(".grouped-alerts");
    await panel
      .getByRole("button", { name: "Cleared (1)", exact: true })
      .click();
    const cleared = panel.locator("details");
    await cleared.locator("summary").click();
    assert.match(await cleared.innerText(), /Reminder:/);
    db.alertPreferences[0].clearedAt = new Date(
      Date.now() - ALERT_REMINDER_MS - 1000,
    ).toISOString();
    await page.reload();
    await page.waitForSelector(".grouped-alerts");
    assert.match(await low.locator("summary").innerText(), /2 Pharmacy items/);
    await low.locator("summary").click();
    await low
      .locator(".alert-group-toolbar")
      .getByRole("button", { name: "Mute", exact: true })
      .click();
    await panel.getByRole("button", { name: "Muted (2)", exact: true }).click();
    await low.locator("summary").click();
    await low
      .locator(".alert-detail-row")
      .first()
      .getByRole("button", { name: "Restore", exact: true })
      .click();
    await panel.getByRole("button", { name: /^Active/ }).click();
    await panel.getByRole("button", { name: "Clear all", exact: true }).click();
    await page
      .getByRole("button", { name: "Move to muted list", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.ok(
      await panel.locator(".alert-critical-summary").isVisible(),
      "expired risk stays visible after mute",
    );
    await panel.getByRole("button", { name: /^Muted/ }).click();
    await panel
      .getByRole("button", { name: "Restore all", exact: true })
      .click();
    await panel.getByRole("button", { name: /^Active/ }).click();
    await low.locator("summary").click();
    await low
      .locator(".alert-group-toolbar")
      .getByRole("button", { name: "Clear", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remind me in 7 days", exact: true })
      .click();
    db.stockSnapshot.find((r) => r.batchId === "m3a").quantity = 20;
    db.stockSnapshot.find((r) => r.batchId === "m4a").quantity = 20;
    await page.reload();
    await page.waitForSelector(".grouped-alerts");
    assert.equal(await low.count(), 0);
    assert.equal(db.alertPreferences.length, 0);
    db.stockSnapshot.find((r) => r.batchId === "m3a").quantity = 5;
    await page.reload();
    await page.waitForSelector(".grouped-alerts");
    assert.match(await low.locator("summary").innerText(), /1 Pharmacy item/);
    await low.locator("summary").click();
    await low.locator(".notification-item").first().click();
    await page.waitForFunction(
      () => document.querySelector(".topbar h1")?.textContent === "Pharmacy",
    );
    await page.goBack();
    await page.waitForSelector(".grouped-alerts");
    assert.equal(await low.count(), 1, "opening an alert must not clear it");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `${width}px overflow`,
    );
    await page.screenshot({
      path: `artifacts/platform-admin/alerts-${width}.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `${width}px: alert controls, recurrence, restock, navigation and layout passed`,
    );
  }
} finally {
  await browser.close();
}
