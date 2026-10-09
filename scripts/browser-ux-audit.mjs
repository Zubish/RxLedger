import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { chromium } from 'playwright';

const source = readFileSync('src/App.tsx', 'utf8');
const emptyFunction = source.slice(source.indexOf('function createEmptyDatabase()'), source.indexOf('function getStockRows'));
const db = vm.runInNewContext(ts.transpile(emptyFunction + '\ncreateEmptyDatabase()', { target: ts.ScriptTarget.ES2022 }), {
  defaultDosageFormLabelRules: {}, builtInMedicineLabelRules: [], trialPolicy: { includedPlan: 'smart-pharmacy', durationDays: 30 }, today: () => '2026-10-09',
});
const now = new Date().toISOString();
db.settings = { ...db.settings, accountName: 'Audit Pharmacy', companySlug: 'audit', companyCode: 'AUDIT', primaryAdminId: 'admin' };
db.branches = ['a', 'b'].map((id, i) => ({ id, name: i ? 'Riverside Branch' : 'Central Pharmacy', code: id.toUpperCase(), address: '12 Pharmacy Street', managerName: 'Alex', managerUserId: 'staff', phone: '08012345678', active: true, createdAt: now }));
db.users = [{ id: 'admin', name: 'Audit Owner', email: 'owner@example.test', phone: '', role: 'admin', status: 'active', branchIds: ['a','b'], managedBranchIds: [], createdAt: now }, { id: 'staff', name: 'Alex Pharmacist', email: 'staff@example.test', phone: '', role: 'pharmacist', status: 'active', branchIds: ['a'], managedBranchIds: [], createdAt: now }];
db.suppliers = [{ id: 'supplier', name: 'Reliable Medical Supplier', contact: '08012345678', address: 'Main Road', licenseRef: 'LIC-01', active: true }];
db.medicines = Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, sku: `MED-${i}`, brandName: ['Paracetamol','Amoxicillin','Metformin','Amlodipine'][i%4], genericName: 'Medicine generic name', form: 'tablet', strength: '500mg', unit: 'tablet', packSize: 10, sellableUnit: 'tablet', costPrice: 100, sellingPrice: 150, category: 'Medicine', manufacturer: 'Pharma', nafdacNumber: 'NAF-01', barcodes: [], reorderLevel: 10, active: true }));
db.batches = db.medicines.flatMap((m,i) => db.branches.map(b => ({ id: `${m.id}${b.id}`, medicineId: m.id, supplierId: 'supplier', batchNumber: `BATCH-${i}`, expiryDate: i===0 ? '2026-09-01' : i===1 ? '2026-11-01' : '2028-01-01', unitCost: 100, sellingPrice: 150, receivedDate: '2026-10-01', location: 'Shelf 1', branchId: b.id })));
db.stockSnapshot = db.batches.map(b => ({ batchId:b.id, quantity: b.medicineId==='m2' ? 0 : 25 }));
db.products = [{ id:'p1', sku:'MART-1', name:'Skin care lotion', category:'Personal care', unit:'bottle', costPrice:1000, sellingPrice:1500, quantity:20, quantityByBranch:{a:5,b:15}, barcodes:[], supplierId:'supplier', active:true, createdAt:now }];
db.sales = db.branches.map(b => ({ id:`sale-${b.id}`, branchId:b.id, cashierUserId:'staff', customerName: b.id==='a'?'Jane Patient':'Foreign Patient', customerPhone:'08012345678', paymentMethod:'cash', reference:`RX-${b.id}`, note:'', soldAt:now, subtotal:1500,discount:0,total:1500,items:[{itemType:'medicine',medicineId:'m0',batchId:`m0${b.id}`,quantity:10,unitPrice:150,lineTotal:1500,daysSupply:30,refillDueAt:'2026-11-01'}] }));
db.continuityRequests = ['open','matched','contacted'].map((status,i) => ({ id:`c${i}`, patientName:`Patient ${i+1}`,patientPhone:'08012345678',medicineId:`m${i}`,requestedMedicineName:'Requested medicine',quantityRequested:10,originBranchId:'a',status,urgency:'routine',source:'manual',createdBy:'staff',createdAt:now,updatedAt:now }));
db.ledgerSummary.today = '2026-10-09';
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
