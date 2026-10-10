import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import db from './fixtures/ux-database.mjs';

// Populate the reminder list as well as the selected follow-up preview.
db.sales.forEach(sale => sale.items.forEach(item => { item.refillDueAt = new Date().toISOString().slice(0, 10); }));

// Independent computed-style checks use the same scoped operational fixture as the UX sweep.
const base = process.env.RXLEDGER_AUDIT_URL || 'http://localhost:5173';
const output = 'artifacts/ux-audit';
const resultsPath = `${output}/${process.argv.includes('--supplement-only') ? 'colour-supplement-results' : process.argv.includes('--preview-only') ? 'colour-preview-results' : 'colour-results'}.json`;
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.RXLEDGER_CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const results = [];
const brand = 'rgb(129, 35, 63)';
const deep = 'rgb(104, 26, 50)';
const screens = ['Dashboard','Continuity','POS','Patients','Pharmacy','Mart','Receive','Reports','Suppliers','Notifications','Team Chat','Settings','Branches','Users','Issue Stock','Adjust/Returns','Audit','Guide'];
async function colour(locator, property = 'color') {
  return locator.evaluate((el, key) => getComputedStyle(el)[key], property);
}
async function assertInteraction(page, selector, property, normal, hover = normal) {
  const locator = page.locator(selector).first();
  if (!await locator.isVisible().catch(() => false)) return;
  await page.mouse.move(0, 0);
  await page.waitForTimeout(180);
  assert.equal(await colour(locator, property), normal, `${selector} default ${property}`);
  await locator.hover();
  await page.waitForTimeout(180);
  assert.equal(await colour(locator, property), hover, `${selector} hover ${property}`);
  await page.keyboard.press('Tab');
  await locator.focus();
  assert.match(await colour(locator, 'outlineColor'), /96, 136, 178|229, 197, 208/, `${selector} focus outline`);
}
try {
  for (const [device, width, height] of [['iphone12',390,844], ['tablet',768,1024], ['desktop',1440,1000]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 1000 });
    await context.addInitScript(() => localStorage.setItem('rxledger-session-active', 'true'));
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const scope = url.searchParams.get('scope');
      const body = url.pathname === '/api/bootstrap' ? { hasUsers: true, tenantExists: true, settings: db.settings }
        : scope === 'sales' ? { sales: db.sales, nextCursor: '' }
        : scope === 'ledger' ? { ledger: db.ledger, nextCursor: '' }
        : scope === 'audit' ? { auditLogs: [] } : { db, currentUser: db.users[0] };
      if (url.pathname === '/api/action') body.databasePatch = Object.fromEntries(['sales','ledger','auditLogs'].map(key => [key, { upserts: [], removedIds: [] }]));
      await route.fulfill({ json: body });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/audit`);
    await page.waitForSelector('.topbar');
    // Dismiss first-run coaching before measuring working controls it can cover.
    const skip = page.locator('.quest-coach-head button').filter({ hasText: 'Skip' });
    if (await skip.isVisible()) await skip.click();
    if (await page.locator('.drawer-handle').isVisible()) await assertInteraction(page, '.drawer-handle', 'backgroundColor', brand, deep);
    const selectedScreens = process.argv.includes('--supplement-only') ? ['POS'] : process.argv.includes('--preview-only') ? ['Patients'] : screens;
    for (const screen of selectedScreens) {
      if (!await page.locator('.sidebar').evaluate(el => !el.inert)) {
        const mobile = page.locator('.mobile-menu-button');
        await (await mobile.isVisible() ? mobile : page.locator('.drawer-handle')).click();
      }
      const nav = page.locator('.sidebar .nav-item').filter({ has: page.locator('span').filter({ hasText: new RegExp(`^${screen}$`) }) });
      if (!await nav.count()) continue;
      await nav.click();
      if (screen === 'Continuity') {
        await page.locator('.nav-submenu button').filter({ hasText: 'Stock available' }).click();
        const details = page.locator('.continuity-dropdown').first();
        await assertInteraction(page, '.continuity-dropdown', 'color', brand);
        if (await details.count()) await details.click();
        const create = page.locator('.continuity-create-panel summary');
        if (await create.count()) await create.click();
      }
      if (width > 900 && await page.locator('.sidebar-close-button').isVisible()) await page.locator('.sidebar-close-button').click();
      await page.waitForTimeout(220);
      await assertInteraction(page, '.primary-button:not(:disabled)', 'backgroundColor', brand, deep);
      await assertInteraction(page, '.ghost-button:not(:disabled)', 'color', 'rgb(41, 62, 76)', 'rgb(56, 91, 128)');
      if (screen === 'POS') {
        await page.getByRole('button', { name: 'View sales history', exact: true }).click();
        await assertInteraction(page, '.pos-period-filter button', 'backgroundColor', brand);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${device} sales-history modal overflow`);
        await page.screenshot({ path: `${output}/${device}-sales-history-colours.png`, fullPage: true });
        await page.getByRole('button', { name: 'Close sales history', exact: true }).click();
      }
      const styles = await page.evaluate(() => {
        const green = value => {
          const channels = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)?.slice(1).map(Number);
          return channels && channels[1] > channels[0] * 1.25 && channels[1] > channels[2] * 1.05 && Math.max(...channels) - Math.min(...channels) > 35;
        };
        return [...document.querySelectorAll('.workspace button,.workspace a,.workspace svg,.workspace strong')]
          .filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().height)
          .flatMap(el => {
            const css = getComputedStyle(el);
            return ['color','backgroundColor','borderColor'].filter(key => green(css[key])).map(key => ({ className: String(el.className?.baseVal ?? el.className), parent: String(el.parentElement?.className), text: el.textContent?.trim().slice(0,70), property: key, value: css[key] }));
          });
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${device} ${screen} overflow`);
      if (screen === 'Patients') {
        await page.locator('.patient-list-item').filter({ hasText: 'Jane Patient' }).click();
        const messages = page.locator('.patient-mobile-sections button').filter({ hasText: /^Messages$/ });
        if (await messages.isVisible()) await messages.click();
        const followup = page.locator('.patient-message-list');
        assert.equal(await followup.locator('.whatsapp-icon').count(), 1, 'Follow-up uses WhatsApp logo');
        const whatsappActions = page.locator('a[href^="https://wa.me/"]');
        assert.ok(await whatsappActions.count() > 1, 'Fixture contains follow-up and refill WhatsApp actions');
        assert.equal(await whatsappActions.locator('.whatsapp-icon').count(), await whatsappActions.count(), 'Every patient WhatsApp action uses the brand logo');
        assert.equal(await whatsappActions.locator('.lucide-smartphone').count(), 0, 'WhatsApp actions no longer use generic phone icons');
        await page.screenshot({ path: `${output}/${device}-whatsapp-preview.png`, fullPage: true });
        await followup.screenshot({ path: `${output}/${device}-whatsapp-detail.png` });
        const history = page.locator('.patient-mobile-sections button').filter({ hasText: /^History$/ });
        if (await history.isVisible()) await history.click();
        await assertInteraction(page, '.patient-history-visit', 'backgroundColor', 'rgb(255, 255, 255)', 'rgb(246, 234, 240)').catch(async error => {
          // The fixture's first visit may already be selected, so its default is rose.
          if (await page.locator('.patient-history-visit').first().getAttribute('class').then(value => value.includes('active'))) {
            assert.equal(await colour(page.locator('.patient-history-visit').first(), 'backgroundColor'), 'rgb(246, 234, 240)');
          } else throw error;
        });
      }
      results.push({ device, screen, semanticGreen: styles });
      writeFileSync(resultsPath, JSON.stringify(results, null, 2));
      console.log(`${device}: ${screen} passed`);
    }
    assert.deepEqual(errors, [], `${device} runtime errors`);
    await context.close();
    if (process.argv.includes('--preview-only')) continue;
    const authContext = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 1000 });
    await authContext.route('**/api/bootstrap', route => route.fulfill({ json: { hasUsers: true, tenantExists: true, settings: db.settings } }));
    const authPage = await authContext.newPage();
    await authPage.goto(`${base}/audit`);
    await authPage.waitForSelector('.login-screen');
    await assertInteraction(authPage, '.primary-button:not(:disabled)', 'backgroundColor', brand, deep);
    await assertInteraction(authPage, '.auth-tabs button.active', 'color', brand);
    assert.equal(await authPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${device} sign-in overflow`);
    await authPage.screenshot({ path: `${output}/${device}-signin-colours.png`, fullPage: true });
    results.push({ device, screen: 'Sign in', semanticGreen: [] });
    await authContext.close();
  }
} finally {
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`Passed colour/interaction/overflow checks on ${results.length} screens; screenshots and computed semantic greens in ${output}.`);
