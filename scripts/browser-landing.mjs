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
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const noOverflow = async () =>
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Overflow at " + width + " " + page.url(),
      );
    await page.goto(base);
    await page.locator(".rl-hero").waitFor();
    await noOverflow();
    await page.getByRole("table").waitFor();
    const trial = page
      .getByRole("button", { name: "Start 30 days free trial", exact: true })
      .first();
    assert.equal(
      await trial.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
      "rgb(129, 35, 63)",
    );
    if (width < 760) {
      assert.equal(await page.locator(".rl-header-create").isVisible(), false);
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await page
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("button", { name: "Create workspace", exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .getByRole("navigation", { name: "Mobile navigation" })
          .isVisible(),
        false,
      );
    } else {
      await page.locator(".rl-header-create").waitFor();
      assert.ok(await page.locator(".rl-sign-in").isVisible());
    }
    for (const name of ["Amina Adewale", "Nnamdi Eze", "Dr. Ifeanyi Okeke"]) {
      await page
        .getByRole("button", { name: "Show testimonial from " + name })
        .click();
      assert.match(
        await page
          .locator('.rl-review-slide[aria-hidden="false"] .rl-review-person')
          .innerText(),
        new RegExp(name),
      );
    }
    await page.screenshot({
      path: "artifacts/platform-admin/landing-restored-" + width + ".png",
      fullPage: true,
    });
    await trial.click();
    await page
      .getByRole("heading", { name: "Make room for a calmer day." })
      .waitFor();
    await noOverflow();
    await page.reload();
    await page
      .getByRole("heading", { name: "Make room for a calmer day." })
      .waitFor();
    await page
      .getByRole("button", { name: "Start trial now", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Create your pharmacy workspace" })
      .waitFor();
    assert.match(
      await page.locator(".auth-onboarding-note").innerText(),
      /30-day free trial/,
    );
    await noOverflow();
    await page.screenshot({
      path: "artifacts/platform-admin/signup-restored-" + width + ".png",
      fullPage: true,
    });
    await page.reload();
    await page
      .getByRole("heading", { name: "Create your pharmacy workspace" })
      .waitFor();
    await page.goBack();
    await page
      .getByRole("heading", { name: "Make room for a calmer day." })
      .waitFor();
    await page.goForward();
    await page
      .getByRole("heading", { name: "Create your pharmacy workspace" })
      .waitFor();
    await page.goto(base + "/?get-started=workspace");
    await page
      .getByRole("heading", { name: "Ready to use RxLedger now?" })
      .waitFor();
    await page
      .locator(".rl-plan")
      .first()
      .getByRole("button", { name: "Create workspace", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Create your pharmacy workspace" })
      .waitFor();
    assert.match(
      await page.locator(".auth-onboarding-note").innerText(),
      /Selected plan: Single Branch/,
    );
    await page.goto(base);
    await page
      .getByRole("button", { name: "Sign in to your pharmacy" })
      .click();
    await page
      .getByRole("heading", { name: "Sign in to RxLedger", exact: true })
      .waitFor();
    await noOverflow();
    await page.reload();
    await page
      .getByRole("heading", { name: "Sign in to RxLedger", exact: true })
      .waitFor();
    await page.screenshot({
      path: "artifacts/platform-admin/login-restored-" + width + ".png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "Landing, reviews, trial/plan routes, login/signup, history and refresh passed",
      width,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
