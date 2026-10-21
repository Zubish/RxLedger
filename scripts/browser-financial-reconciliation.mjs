import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import source from './fixtures/ux-database.mjs';
import {isolatedApi} from './helpers/isolated-api.mjs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const base=process.env.RXLEDGER_AUDIT_URL || 'http://localhost:5173';
mkdirSync('artifacts/financial-reconciliation',{recursive:true});
try{for(const width of [390,1440]){
 const fixture=structuredClone(source);fixture.sales=[];fixture.posDrafts=[];fixture.continuityRequests=[];fixture.auditLogs=[];
 fixture.medicines.find(m=>m.id==='m1').sellingPrice=0.1;fixture.batches.forEach(batch=>batch.expiryDate='2099-01-01');
 fixture.ledger=fixture.batches.map(batch=>({id:`in-${batch.id}`,batchId:batch.id,medicineId:batch.medicineId,quantity:25,type:'stock-in',reason:'Synthetic receipt',reference:'SYNTHETIC',createdAt:new Date().toISOString(),userId:'admin'}));
 const api=await isolatedApi(fixture,'audit','admin');const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});const errors=[];
 await context.addInitScript(()=>{localStorage.setItem('rxledger-session-active','true');window.open=()=>null;});
 await context.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(!['/api/bootstrap','/api/state','/api/action'].includes(url.pathname)){await route.fulfill({status:204});return;}
  const body=route.request().method()==='POST'?route.request().postDataJSON():undefined;
  const result=await api.invoke(url.pathname+url.search,body);await route.fulfill({status:result.code,json:result.body});
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(base+'/audit#/pos');await page.locator('#pos-customer-name').waitFor();
  const skip=page.locator('.quest-coach-head button').filter({hasText:'Skip'});if(await skip.isVisible())await skip.click();
  await page.getByPlaceholder('Search product, batch or scan barcode...').fill('Amoxicillin');await page.locator('.pos-catalog-card').first().click();
  await page.getByPlaceholder('Enter amount paid').fill('1');
  await page.getByRole('button',{name:'Complete sale',exact:true}).click();await page.waitForSelector('.pos-checkout-status[data-phase="confirmed"]');
  const sale=(await api.read()).sales[0];assert.equal(sale.total,0.1);assert.equal(sale.cashTendered,1);assert.equal(sale.changeGiven,0.9);assert.equal(sale.items[0].unitCost,100);
  await page.goto(base+'/audit#/reports');await page.getByRole('button',{name:'Sales reconciliation',exact:true}).click();
  const panel=page.locator('.financial-reconciliation');await panel.getByRole('button',{name:'Run reconciliation',exact:true}).click();await panel.getByRole('status').waitFor();
  assert.match(await panel.getByRole('status').innerText(),/1 sales.*0\.10.*0 sales need review/);
  assert.match(await panel.innerText(),/cash:.*0\.10/);assert.match(await panel.innerText(),/Tax is not configured/);
  assert.match(await panel.innerText(),/Amounts and stock match/);
  const downloaded=page.waitForEvent('download');await panel.getByRole('button',{name:'Export reconciliation CSV'}).click();const download=await downloaded;const csv=readFileSync(await download.path(),'utf8');assert.ok(csv.includes(sale.reference));assert.ok(csv.includes('"0.1"'));assert.ok(csv.includes('"100"'));assert.ok(csv.includes('"0.9"'));assert.ok(csv.includes('"-99.9"'));
  await page.screenshot({path:`artifacts/financial-reconciliation/report-${width}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow');assert.deepEqual(errors,[]);
  console.log(`Financial browser → API → PostgreSQL passed ${width}px: saved cash/change/cost, balanced server report and CSV.`);
 }finally{await context.close();await api.close();}
}}finally{await browser.close();}
