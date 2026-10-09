import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import db from './fixtures/ux-database.mjs';

const base = process.env.RXLEDGER_AUDIT_URL || 'http://localhost:5173';
const output = 'artifacts/mobile-hierarchy';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.RXLEDGER_CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const results = [];
const visible = async (locator, expected, message) => assert.equal(await locator.isVisible(), expected, message);
try {
  for (const [device, width, height] of [['small-phone',320,740],['iphone12',390,844],['tablet',768,1024],['desktop',1440,1000]]) {
    const mobile = width < 768;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 1000 });
    await context.addInitScript(() => localStorage.setItem('rxledger-session-active', 'true'));
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const scope = url.searchParams.get('scope');
      const body = url.pathname === '/api/bootstrap' ? { hasUsers: true, tenantExists: true, settings: db.settings }
        : scope === 'sales' ? { sales: db.sales, nextCursor: '' }
        : scope === 'ledger' ? { ledger: db.ledger, nextCursor: '' }
        : scope === 'audit' ? { auditLogs: [] } : { db, currentUser: db.users[0] };
      await route.fulfill({ json: body });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/audit`);
    await page.waitForSelector('.topbar');
    const skip = page.locator('.quest-coach-head button').filter({ hasText: 'Skip' });
    if (await skip.isVisible()) await skip.click();
    async function nav(screen) {
      if (!await page.locator('.sidebar').evaluate(el => !el.inert)) {
        const menu = page.locator('.mobile-menu-button');
        await (await menu.isVisible() ? menu : page.locator('.drawer-handle')).click();
      }
      await page.locator('.sidebar .nav-item').filter({ has: page.locator('span').filter({ hasText: new RegExp(`^${screen}$`) }) }).click();
      if (await page.locator('.sidebar').evaluate(el => !el.inert)) await page.locator('.sidebar-close-button').click();
      await page.waitForTimeout(120);
    }
    async function capture(screen) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${device} ${screen} horizontal overflow`);
      await page.screenshot({ path: `${output}/${device}-${screen}.png`, fullPage: true, animations: 'disabled' });
      results.push({ device, screen });
      console.log(`${device}: ${screen} passed`);
    }
    if (width > 900) {
      await page.locator('.drawer-handle').click();
      assert.equal(await page.locator('.sidebar-close-button').evaluate(el => getComputedStyle(el, '::before').display), 'none', 'Desktop close bar removed');
      await page.locator('.sidebar-close-button').click();
      assert.equal(await page.locator('.sidebar').evaluate(el => el.inert), true, 'Desktop X still closes sidebar');
    }
    await nav('Dashboard');
    await visible(page.locator('.dashboard-mobile-navigation'), mobile, 'Dashboard compact navigation breakpoint');
    if (mobile) {
      await visible(page.locator('.dashboard-account'), true, 'Overview visible by default');
      await visible(page.locator('.dashboard-alerts'), false, 'Alerts separated from overview');
      await page.locator('.dashboard-mobile-navigation button').filter({ hasText: /^Stock$/ }).click();
      await visible(page.locator('.dashboard-account'), false, 'Overview hidden on Stock');
      await visible(page.locator('.dashboard-snapshot'), true, 'Stock snapshot available');
      await capture('dashboard-stock');
      await page.locator('.dashboard-mobile-navigation button').filter({ hasText: /^Alerts/ }).click();
      await visible(page.locator('.dashboard-alerts'), true, 'Alerts available');
      await visible(page.locator('.dashboard-snapshot'), false, 'Stock hidden on Alerts');
      await capture('dashboard-alerts');
      await page.locator('.dashboard-mobile-navigation button').filter({ hasText: /^Overview$/ }).click();
    } else {
      await visible(page.locator('.dashboard-account'), true, 'Wide overview visible');
      await visible(page.locator('.dashboard-alerts'), true, 'Wide alerts visible');
    }
    await capture('dashboard-overview');
    await nav('Patients');
    await visible(page.locator('.patient-overview-toggle'), mobile, 'Patient overview disclosure breakpoint');
    if (mobile) {
      await visible(page.locator('.patient-overview-content'), false, 'Patient secondary overview collapsed');
      await page.locator('.patient-overview-toggle').click();
      await visible(page.locator('.patient-overview-content'), true, 'Patient secondary overview expands');
      await page.locator('.patient-overview-toggle').click();
    }
    await page.locator('.patient-list-item').filter({ hasText: 'Jane Patient' }).click();
    const profile = page.locator('.patient-profile-panel');
    await visible(profile.locator('.patient-mobile-sections'), mobile, 'Patient sections breakpoint');
    if (mobile) {
      await visible(profile.locator('.patient-message-list'), false, 'Messages hidden while browsing history');
      await profile.locator('.patient-mobile-sections button').filter({ hasText: /^Messages$/ }).click();
      await visible(profile.locator('.patient-message-list'), true, 'Messages accessible in dedicated section');
      await visible(profile.locator('.patient-timeline'), false, 'History hidden while reading messages');
    }
    const whatsapp = profile.locator('a[href^="https://wa.me/"]');
    assert.equal(await whatsapp.locator('.whatsapp-icon').count(), await whatsapp.count(), 'Patient WhatsApp logos');
    await capture('patients-messages');
    await nav('Reports');
    await visible(page.locator('.mobile-report-selector'), width <= 767, 'Report compact selector breakpoint');
    await visible(page.locator('.report-desktop-tabs'), width > 767, 'Report desktop tabs breakpoint');
    if (width <= 767) {
      const filter = page.locator('.reports-panel .mobile-disclosure');
      await visible(filter.locator('.mobile-disclosure-content'), false, 'Report filters start collapsed');
      await filter.locator('.mobile-disclosure-toggle').click();
      await visible(filter.locator('.report-filters'), true, 'Report filters accessible');
      await capture('report-filters');
      await filter.locator('.mobile-disclosure-toggle').click();
      await page.locator('.mobile-report-selector select').selectOption('movement');
      await visible(page.locator('.reports-panel .mobile-disclosure-content'), false, 'Movement filters start collapsed');
    }
    await capture('reports');
    await nav('Continuity');
    const details = page.locator('.continuity-dropdown').first();
    assert.equal(await details.getAttribute('aria-expanded'), 'false');
    await details.click();
    const request = page.locator('.continuity-request-item').first();
    const disclosure = request.locator('.mobile-disclosure').filter({ has: page.locator('.mobile-disclosure-toggle').filter({ hasText: 'Stock and request details' }) });
    await visible(disclosure.locator('.mobile-disclosure-toggle'), width <= 767, 'Continuity disclosure breakpoint');
    if (width <= 767) {
      await visible(disclosure.locator('.mobile-disclosure-content'), false, 'Continuity secondary information collapsed');
      await visible(request.locator('.continuity-quantity'), true, 'Needed quantity always visible');
      await disclosure.locator('.mobile-disclosure-toggle').click();
      await visible(disclosure.locator('.mobile-disclosure-content'), true, 'Continuity secondary information accessible');
      await capture('continuity-expanded');
      await disclosure.locator('.mobile-disclosure-toggle').click();
    }
    const continuityWhatsApp = request.locator('a[href^="https://wa.me/"]');
    if (await continuityWhatsApp.count()) assert.equal(await continuityWhatsApp.locator('.whatsapp-icon').count(), await continuityWhatsApp.count(), 'Continuity WhatsApp logos');
    await capture('continuity');
    await details.click();
    assert.equal(await page.locator('.continuity-request-item').count(), 0, 'Continuity details close');
    assert.deepEqual(errors, [], `${device} runtime errors`);
    await context.close();
  }
} finally {
  writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`Passed ${results.length} mobile hierarchy screen checks.`);
