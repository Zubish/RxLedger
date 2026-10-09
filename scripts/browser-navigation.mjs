import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import db from './fixtures/ux-database.mjs';

const browser = await chromium.launch({ executablePath: process.env.RXLEDGER_CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const base = process.env.RXLEDGER_AUDIT_URL || 'http://localhost:5173';
const screens = ['Dashboard','POS','Patients','Continuity','Pharmacy','Receive','Issue Stock','Adjust/Returns','Suppliers','Mart','Reports','Notifications','Team Chat','Branches','Users','Audit','Settings'];
try {
 for (const width of [390,768,1440]) {
  const context = await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(() => localStorage.setItem('rxledger-session-active','true'));
  let expired = false;
  let staff = false;
  await context.route('**/api/**', async route => {
   const url = new URL(route.request().url());
   if (expired && url.pathname !== '/api/bootstrap') return route.fulfill({status:401,json:{error:'Authentication required'}});
   const scope = url.searchParams.get('scope');
   const body = url.pathname === '/api/bootstrap' ? {hasUsers:true,tenantExists:true,settings:db.settings}
    : scope === 'sales' ? {sales:db.sales,nextCursor:''} : scope === 'ledger' ? {ledger:db.ledger,nextCursor:''}
    : scope === 'audit' ? {auditLogs:[]} : {db,currentUser:db.users[staff?1:0]};
   if(url.pathname === '/api/action') body.databasePatch=Object.fromEntries(['sales','ledger','auditLogs'].map(key=>[key,{upserts:[],removedIds:[]}]));
   await route.fulfill({json:body});
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR',error.message); });
  await page.goto(`${base}/audit`);
  await page.waitForSelector('.topbar');
  const skip=page.locator('.quest-coach-head button').filter({hasText:'Skip'});
  if(await skip.isVisible()) await skip.click();
  async function nav(label) {
   console.log(width, label);
   if(await page.locator('.sidebar').evaluate(el=>el.inert)) {
    const mobile=page.locator('.mobile-menu-button');
    await (await mobile.isVisible()?mobile:page.locator('.drawer-handle')).click();
   }
   await page.locator('.sidebar .nav-item').filter({has:page.locator('span').filter({hasText:new RegExp(`^${label}$`)})}).click();
   if(await page.locator('.sidebar').evaluate(el=>!el.inert)) await page.locator('.sidebar-close-button').click();
   await page.waitForFunction(label=>document.querySelector('.topbar h1')?.textContent===label,label);
  }
  if(process.argv.includes('--login-only')) {
   expired=true;
   await page.goto(`${base}/audit#/reports`);
   await page.reload();
   await page.waitForSelector('input[type="password"]');
   expired=false;
   await page.locator('input[type="email"]').fill('audit@example.test');
   await page.locator('input[type="password"]').fill('fixture-password');
   await page.getByRole('button',{name:'Log in',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.topbar h1')?.textContent==='Reports');
   assert.equal(new URL(page.url()).hash,'#/reports');
   assert.deepEqual(errors,[]);
   await context.close();
   console.log(`${width}px: login restores requested page`);
   continue;
  }
  for(const label of screens) {
   await nav(label);
   const hash = new URL(page.url()).hash;
   await page.reload();
   await page.waitForSelector('.topbar');
   await page.waitForFunction(label=>document.querySelector('.topbar h1')?.textContent===label,label);
   assert.equal(new URL(page.url()).hash,hash,`${width}: refresh preserves ${label}`);
  }
  await nav('Reports');
  await nav('Patients');
  await nav('Settings');
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('.topbar h1')?.textContent==='Patients');
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('.topbar h1')?.textContent==='Reports');
  await page.goForward();
  await page.waitForFunction(()=>document.querySelector('.topbar h1')?.textContent==='Patients');
  await nav('Continuity');
  await page.locator('.continuity-status-select select').selectOption('transferred');
  await page.locator('.continuity-status-select select').selectOption('matched');
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('.continuity-status-select select')?.value==='transferred');
  await page.goForward();
  await page.waitForFunction(()=>document.querySelector('.continuity-status-select select')?.value==='matched');
  await page.reload();
  await page.waitForSelector('.continuity-status-select select');
  assert.equal(await page.locator('.continuity-status-select select').inputValue(),'matched');
  // Content links also need history, not just sidebar actions.
  await nav('Dashboard');
  const reports = page.locator('.dashboard-snapshot button').filter({hasText:'View reports'});
  if(width<768) await page.locator('.dashboard-mobile-navigation button').filter({hasText:/^Stock$/}).click();
  await reports.click();
  await page.waitForFunction(()=>location.hash==='#/reports');
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('.topbar h1')?.textContent==='Dashboard');
  staff=true;
  await page.goto(`${base}/audit#/users`);
  await page.reload();
  await page.waitForSelector('.topbar');
  await page.waitForFunction(()=>location.hash==='#/dashboard');
  assert.equal(await page.locator('.topbar h1').innerText(),'Dashboard');
  expired=true;
  await page.goto(`${base}/#/reports`);
  await page.waitForSelector('input[type="password"]');
  assert.equal(await page.locator('.topbar').count(),0);
  await page.reload();
  await page.waitForSelector('input[type="password"]');
  assert.equal(await page.locator('.topbar').count(),0);
  await page.goto(`${base}/`);
  await page.waitForSelector('input[type="password"]');
  await page.waitForFunction(()=>location.hash==='#/dashboard');
  await page.reload();
  await page.waitForSelector('input[type="password"]');
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(`${width}px: all 17 page refreshes, Back/Forward, submenu, content links, access guard and expired-session login passed`);
 }
} finally { await browser.close(); }
