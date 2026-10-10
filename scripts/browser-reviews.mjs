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
    await page.getByRole("button", { name: "Pause review slideshow" }).click();
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.activeElement?.blur());
    await page.clock.runFor(8500);
    assert.equal(await current(), "Amina Adewale");
    await page.getByRole("button", { name: "Resume review slideshow" }).click();
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.activeElement?.blur());
    await page.clock.runFor(8100);
    assert.equal(await current(), "Nnamdi Eze");
    await page.clock.runFor(8100);
    assert.equal(await current(), "Dr. Ifeanyi Okeke");
    await page.keyboard.press("Tab");
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
    const dots = page.locator(".rl-review-controls button");
    assert.equal(await dots.count(), 3);
    assert.deepEqual(await dots.allTextContents(), ["", "", ""]);
    assert.equal(await page.locator(".rl-review-pause").count(), 0);
    assert.equal(
      await page
        .locator(
          '.rl-review-controls button[aria-pressed="true"] .rl-review-dot',
        )
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgb(129, 35, 63)",
    );
    assert.equal(
      await page
        .locator(
          '.rl-review-controls button[aria-pressed="false"] .rl-review-dot',
        )
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgba(0, 0, 0, 0)",
    );
    const glass = await page
      .locator(".rl-review-panel")
      .evaluate((element) => getComputedStyle(element).backdropFilter);
    assert.match(glass, /blur\(18px\)/);
    await page.locator(".rl-reviews").screenshot({
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
  assert.equal(await page.locator(".rl-review-pause").count(), 0);
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
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await mobile.route("**/api/**", (route) =>
    route.fulfill({
      json: { hasUsers: true, tenantExists: true, settings: db.settings },
    }),
  );
  const touch = await mobile.newPage();
  await touch.clock.install();
  await touch.goto(base);
  await touch.locator(".rl-review-viewport").waitFor();
  await touch
    .locator(".rl-review-viewport")
    .dispatchEvent("pointerdown", { pointerType: "touch" });
  await touch.clock.runFor(8500);
  assert.equal(
    await touch
      .locator('.rl-review-slide[aria-hidden="false"] .rl-review-person strong')
      .innerText(),
    "Dr. Ifeanyi Okeke",
  );
  await touch
    .locator(".rl-review-viewport")
    .dispatchEvent("pointercancel", { pointerType: "touch" });
  await touch.clock.runFor(8100);
  assert.equal(
    await touch
      .locator('.rl-review-slide[aria-hidden="false"] .rl-review-person strong')
      .innerText(),
    "Amina Adewale",
  );
  await touch.locator(".rl-review-viewport").tap();
  await touch.clock.runFor(8500);
  assert.equal(
    await touch
      .locator('.rl-review-slide[aria-hidden="false"] .rl-review-person strong')
      .innerText(),
    "Amina Adewale",
  );
  await touch.locator(".rl-review-viewport").tap();
  await touch.clock.runFor(8100);
  assert.equal(
    await touch
      .locator('.rl-review-slide[aria-hidden="false"] .rl-review-person strong')
      .innerText(),
    "Nnamdi Eze",
  );
  console.log(
    "Mobile touch hold, cancellation, tap pause and tap resume passed",
  );
  await mobile.close();
  await context.close();
} finally {
  await browser.close();
}
