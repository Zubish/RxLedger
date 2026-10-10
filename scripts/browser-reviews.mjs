import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import db from "./fixtures/ux-database.mjs";
const base = process.env.RXLEDGER_AUDIT_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
  proxy:
    process.env.RXLEDGER_AUDIT_URL && process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY }
      : undefined,
});
await mkdir("artifacts/platform-admin", { recursive: true });
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      ignoreHTTPSErrors: true,
    });
    await context.route("**/api/**", (route) =>
      route.fulfill({
        json: { hasUsers: true, tenantExists: true, settings: db.settings },
      }),
    );
    const page = await context.newPage();
    await page.clock.install();
    await page.goto(base);
    await page.locator(".rl-review-panel").waitFor();
    const current = () =>
      page
        .locator(
          '.rl-review-slide[aria-hidden="false"] .rl-review-person strong',
        )
        .innerText();
    assert.equal(await current(), "Dr. Ifeanyi Okeke");
    await page.clock.runFor(8100);
    assert.equal(await current(), "Amina Adewale");
    await page.locator(".rl-review-panel").hover();
    const panelHeight = await page
      .locator(".rl-review-panel")
      .evaluate((element) => element.getBoundingClientRect().height);
    await page.clock.runFor(8500);
    assert.equal(await current(), "Amina Adewale");
    await page.getByRole("button", { name: "Pause slideshow" }).click();
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.activeElement?.blur());
    await page.clock.runFor(8500);
    assert.equal(await current(), "Amina Adewale");
    await page.getByRole("button", { name: "Resume slideshow" }).click();
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.activeElement?.blur());
    await page.clock.runFor(8100);
    assert.equal(await current(), "Nnamdi Eze");
    await page.clock.runFor(8100);
    assert.equal(await current(), "Dr. Ifeanyi Okeke");
    await page
      .getByRole("button", { name: "Show testimonial from Nnamdi Eze" })
      .focus();
    await page.clock.runFor(8500);
    assert.equal(await current(), "Dr. Ifeanyi Okeke");
    await page
      .getByRole("button", { name: "Show testimonial from Nnamdi Eze" })
      .click();
    await page.clock.runFor(700);
    assert.equal(await current(), "Nnamdi Eze");
    assert.equal(
      await page
        .locator(".rl-review-panel")
        .evaluate((element) => element.getBoundingClientRect().height),
      panelHeight,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const glass = await page
      .locator(".rl-review-panel")
      .evaluate((element) => getComputedStyle(element).backdropFilter);
    assert.match(glass, /blur\(18px\)/);
    await page
      .locator(".rl-reviews")
      .screenshot({
        path: "artifacts/platform-admin/glass-reviews-" + width + ".png",
        animations: "disabled",
      });
    console.log(
      "Glass, autoplay, hover/focus/pause, manual selection, wrap and stable layout passed",
      width,
    );
    await context.close();
  }
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("**/api/**", (route) =>
    route.fulfill({
      json: { hasUsers: true, tenantExists: true, settings: db.settings },
    }),
  );
  const page = await context.newPage();
  await page.clock.install();
  await page.goto(base);
  await page.locator(".rl-review-panel").waitFor();
  await page.clock.runFor(17000);
  assert.equal(
    await page
      .locator('.rl-review-slide[aria-hidden="false"] .rl-review-person strong')
      .innerText(),
    "Dr. Ifeanyi Okeke",
  );
  assert.equal(
    await page.getByRole("button", { name: "Pause slideshow" }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "Show testimonial from Amina Adewale" })
    .click();
  assert.equal(
    await page
      .locator('.rl-review-slide[aria-hidden="false"] .rl-review-person strong')
      .innerText(),
    "Amina Adewale",
  );
  console.log("Reduced motion retains manual navigation and disables autoplay");
  await context.close();
} finally {
  await browser.close();
}
