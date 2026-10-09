import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import db from './fixtures/ux-database.mjs';
import { chromium } from 'playwright';

mkdirSync('artifacts/ux-audit', {recursive:true});
const browser = await chromium.launch({ executablePath:process.env.RXLEDGER_CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox'] });
const results=[];
for (const [device,width,height] of [['iphone12',390,844],['small-phone',320,740],['tablet',768,1024],['desktop',1440,1000],['iphone12-staff',390,844]]) {
 if(process.argv.includes('--staff-only') && !device.endsWith('staff')) continue;
 const currentUser = db.users[device.endsWith('staff') ? 1 : 0];
 const context=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<1000});
 await context.addInitScript(()=>localStorage.setItem('rxledger-session-active','true'));
 await context.route('**/api/**', async route => {
  const url=new URL(route.request().url());
  const body=url.pathname==='/api/bootstrap'?{hasUsers:true,tenantExists:true,settings:db.settings}:url.searchParams.get('scope')==='sales'?{sales:db.sales,nextCursor:''}:url.searchParams.get('scope')==='ledger'?{ledger:db.ledger,nextCursor:''}:url.searchParams.get('scope')==='audit'?{auditLogs:[]}:{db,currentUser};
  if(url.pathname==='/api/action') body.databasePatch=Object.fromEntries(['sales','ledger','auditLogs'].map(key=>[key,{upserts:[],removedIds:[]} ]));
  await route.fulfill({json:body});
 });
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',device,e.message)});
 await page.goto('http://localhost:5173/audit'); await page.waitForSelector('.topbar');
 if(process.argv.includes('--interactions-only')) {
  const trigger=width<=900?page.locator('.mobile-menu-button'):page.locator('.drawer-handle');
  await trigger.click();
  if(width<=900) {
   assert.equal(await page.locator('.sidebar').getAttribute('aria-modal'),'true');
   await page.keyboard.press('Shift+Tab');
   assert.ok(await page.locator('.sidebar').evaluate(el=>el.contains(document.activeElement)));
   await page.keyboard.press('Escape');
   assert.ok(await page.locator('.sidebar').evaluate(el=>el.inert));
   await trigger.click();
  }
  await page.locator('.sidebar .nav-item').filter({hasText:'Continuity'}).click();
  await page.screenshot({path:`artifacts/ux-audit/${device}-navigation.png`});
  await page.locator('.nav-submenu button').filter({hasText:'Waiting'}).click();
  assert.equal(await page.locator('.continuity-status-select select').inputValue(),'open');
  if(width<=900) assert.ok(await page.locator('.sidebar').evaluate(el=>el.inert));
  else { assert.ok(await page.locator('.sidebar').evaluate(el=>!el.inert)); await page.locator('.sidebar-close-button').click(); }
  await page.locator('.branch-switcher-trigger').click();
  if(currentUser.role==='admin') {
   await page.locator('.branch-menu button').filter({hasText:'Riverside Branch'}).click();
   await page.waitForTimeout(1000);
   assert.match(await page.locator('.branch-trigger-text strong').innerText(),/Riverside/);
  } else {
   assert.equal(await page.locator('.branch-menu button').filter({hasText:'Riverside Branch'}).count(),0);
   await page.locator('.branch-switcher-trigger').click();
  }
  const guide=page.locator('.quest-disclosure');
  if(width<=900 && await guide.count()) { await guide.click(); assert.equal(await guide.getAttribute('aria-expanded'),'true'); await guide.click(); }
  assert.equal(errors.length,0);
  console.log('Interaction checks passed:',device);
  await context.close();
  continue;
 }
 for (const [view,label] of [['dashboard','Dashboard'],['continuity','Continuity'],['pos','POS'],['patients','Patients'],['medicines','Pharmacy'],['products','Mart'],['receive','Receive'],['reports','Reports'],['suppliers','Suppliers'],['notifications','Notifications'],['chat','Team Chat'],['settings','Settings'],['branches','Branches'],['users','Users'],['issue','Issue Stock'],['adjust','Adjust/Returns']]) {
  if(currentUser.role !== 'admin' && ['users','branches'].includes(view)) continue;
  const trigger=page.locator('.mobile-menu-button');
  if(!await page.locator('.sidebar').evaluate(el=>!el.inert)) { const menu=await trigger.isVisible()?trigger:page.locator('.drawer-handle'); await menu.click(); }
  await page.locator('.sidebar .nav-item').filter({has:page.locator('span').filter({hasText:new RegExp(`^${label}$`)})}).click();
  if(view==='continuity') {
   await page.locator('.sidebar .nav-submenu button').filter({hasText:'Stock available'}).click();
   assert.equal(await page.locator('.continuity-status-select select').inputValue(),'matched');
   const create=page.locator('.continuity-create-panel summary');
   if(await create.count()) { await create.click(); await page.screenshot({path:`artifacts/ux-audit/${device}-continuity-create.png`,fullPage:true}); await create.click(); }
   const detail=page.locator('.continuity-dropdown').first();
   if(await detail.count()) { await detail.click(); assert.equal(await detail.getAttribute('aria-expanded'),'true'); }
  }
  await page.waitForTimeout(200);
  const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('.workspace *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2&&!el.closest('.table-wrap,.tabs,.report-mode-switch')}).slice(0,12).map(el=>({tag:el.tagName,class:el.className,right:Math.round(el.getBoundingClientRect().right)}))}));
  await page.screenshot({path:`artifacts/ux-audit/${device}-${view}.png`,fullPage:true});
  results.push({device,view,...metrics,errors:[...errors]});
  if(view==='patients' && currentUser.role !== 'admin') assert.equal(await page.getByText('Foreign Patient',{exact:true}).count(),0);
  writeFileSync('artifacts/ux-audit/results.json',JSON.stringify(results,null,2));
  console.log(device,view,metrics.scrollWidth,JSON.stringify(errors));
 }
 await context.close();
}
await browser.close();
if(process.argv.includes('--interactions-only')) process.exit(0);
writeFileSync('artifacts/ux-audit/results.json',JSON.stringify(results,null,2));
assert.ok(results.every(row=>row.scrollWidth<=row.width), 'Page overflow detected; inspect results.json');
assert.ok(results.every(row=>row.errors.length===0), 'Browser errors detected; inspect results.json');
console.log(JSON.stringify(results.map(({device,view,width,scrollWidth,errors})=>({device,view,width,scrollWidth,errors})),null,2));
