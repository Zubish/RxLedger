import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import source from './fixtures/ux-database.mjs';
import {isolatedApi} from './helpers/isolated-api.mjs';

const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const base=process.env.RXLEDGER_AUDIT_URL || 'http://localhost:5173';
mkdirSync('artifacts/checkout-reliability',{recursive:true});
try {for(const width of [390,1440]) {
 const fixture=structuredClone(source);
 fixture.batches.forEach(batch=>batch.expiryDate='2099-01-01');
 fixture.ledger=fixture.batches.map(batch=>({id:`in-${batch.id}`,batchId:batch.id,medicineId:batch.medicineId,quantity:25,type:'stock-in',reason:'Synthetic receipt',reference:'SYNTHETIC',createdAt:new Date().toISOString(),userId:'admin'}));
 const api=await isolatedApi(fixture,'audit','admin');
 const context=await browser.newContext({viewport:{width,height:1000}});
 await context.addInitScript(()=>{localStorage.setItem('rxledger-session-active','true');window.open=()=>null;});
 let mode='normal';const submissions=[];const receipts=[];
 await context.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(!['/api/bootstrap','/api/state','/api/action'].includes(url.pathname)) {await route.fulfill({status:204});return;}
  const body=route.request().method()==='POST'?route.request().postDataJSON():undefined;
  if(body?.action==='recordSale') {
   submissions.push(structuredClone(body.payload));
   if(mode==='drop-before-request'){mode='normal';await route.abort('failed');return;}
   if(mode==='reject-retry'){mode='normal';await route.fulfill({status:400,json:{error:'Synthetic rejected retry',checkoutState:'rejected'}});return;}
  }
  const result=await api.invoke(url.pathname+url.search,body);
  if(body?.action==='recordSale' && result.code===200)receipts.push(result.body.checkout.sale.reference);
  if(body?.action==='recordSale' && mode==='drop-after-commit') {
   mode='normal';await new Promise(resolve=>setTimeout(resolve,150));await route.abort('failed');return;
  }
  if(body?.action==='recordSale' && mode==='truncate-after-commit') {
   mode='normal';await route.fulfill({status:200,contentType:'application/json',body:'{"checkout":'});return;
  }
  await route.fulfill({status:result.code,json:result.body});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const count=async()=>{const db=await api.read();return {sales:db.sales.length,stock:db.ledger.filter(row=>row.batchId==='m1a').reduce((sum,row)=>sum+row.quantity,0),audits:db.auditLogs.filter(row=>row.action==='Completed POS sale').length};};
 const phase=async expected=>page.waitForSelector(`.pos-checkout-status[data-phase="${expected}"]`);
 const add=async()=>{
  await page.getByPlaceholder('Search product, batch or scan barcode...').fill('Amoxicillin');
  await page.locator('.pos-catalog-card').first().click();
 };
 const assertOpaqueStorage=async()=>{
  const values=await page.evaluate(()=>Object.entries(sessionStorage).filter(([key])=>key.includes(':checkout:')).map(([,value])=>value));
  assert.equal(values.length,1);assert.match(values[0],/^[0-9a-f-]{36}$/);
 };
 try {
  await page.goto(base+'/audit#/pos');await page.locator('#pos-customer-name').waitFor();
  const skip=page.locator('.quest-coach-head button').filter({hasText:'Skip'});if(await skip.isVisible())await skip.click();
  const initial=await count();
  await add();mode='drop-after-commit';
  await page.locator('form.pos-checkout-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  await phase('unconfirmed');assert.equal(submissions.length,1,'Synchronous guard prevents a double submission');
  assert.equal(await page.locator('#pos-customer-name').isDisabled(),true);
  assert.equal(await page.locator('.complete').isDisabled(),true);
  await assertOpaqueStorage();
  mode='reject-retry';
  await page.getByRole('button',{name:'Retry confirmation',exact:true}).click();await phase('unconfirmed');
  assert.equal(await page.locator('#pos-customer-name').isDisabled(),true,'A rejected retry cannot prove the earlier request did not commit');
  await page.getByRole('button',{name:'Retry confirmation',exact:true}).click();await phase('confirmed');
  assert.equal(submissions.length,3);assert.ok(submissions.every(row=>row.operationId===submissions[0].operationId));
  assert.equal(await page.locator('.notice-panel.danger').count(),0,'A blocked print popup must not suggest checkout failed');
  assert.equal(receipts[0],receipts[1]);assert.match(await page.locator('.pos-confirmed-receipt').innerText(),new RegExp(receipts[0]));
  assert.deepEqual(await count(),{sales:initial.sales+1,stock:initial.stock-1,audits:initial.audits+1});
  await page.screenshot({path:`artifacts/checkout-reliability/confirmed-${width}.png`,fullPage:true});

  // No request reached the server. Refresh recovers only the opaque ID; explicit
  // cancellation records a tombstone so a delayed request cannot arrive later.
  await add();mode='drop-before-request';await page.locator('.complete').click();await phase('unconfirmed');
  const neverSent=submissions.at(-1);await assertOpaqueStorage();
  await page.reload();await phase('unconfirmed');
  await page.getByRole('button',{name:'Check confirmation',exact:true}).click();await phase('unconfirmed');
  await page.getByRole('button',{name:'Cancel unconfirmed checkout',exact:true}).click();await phase('cancelled');
  assert.equal((await api.action('recordSale',neverSent)).code,400);
  assert.deepEqual(await count(),{sales:initial.sales+1,stock:initial.stock-1,audits:initial.audits+1});

  // A committed sale survives a truncated JSON response and page refresh.
  await add();mode='truncate-after-commit';await page.locator('.complete').click();await phase('unconfirmed');
  const afterCommit=await count();await page.reload();await phase('unconfirmed');
  await page.getByRole('button',{name:'Check confirmation',exact:true}).click();await phase('confirmed');
  assert.deepEqual(await count(),afterCommit);
  assert.deepEqual(afterCommit,{sales:initial.sales+2,stock:initial.stock-2,audits:initial.audits+2});

  // A definite validation rejection leaves the cart editable and stock intact.
  await add();const stale=await api.read();stale.medicines.find(row=>row.id==='m1').active=false;await api.shared.saveTenantDatabase('audit',stale);
  await page.locator('.complete').click();await phase('failed');
  assert.equal(await page.locator('#pos-customer-name').isDisabled(),false);
  assert.equal(await page.locator('.pos-line-item').count()>0,true);
  assert.deepEqual(await count(),afterCommit);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log(`Checkout browser → actual API → isolated PostgreSQL passed at ${width}px: double submit, dropped response, retry, refresh, cancellation, rejection.`);
 } finally {await context.close();await api.close();}
}}finally{await browser.close();}
