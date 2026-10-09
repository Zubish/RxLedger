import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fixture from './fixtures/ux-database.mjs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {
 for (const initiallyDeleted of [false,true]) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(()=>{
   localStorage.setItem('rxledger-session-active','true');
   localStorage.setItem('rxledger-company-slug','audit');
   localStorage.setItem('rxledger:audit:admin:notification-dismissals','private');
   localStorage.setItem('rxledger:demo:demo-user:settings','keep');
  });
  let deleted=initiallyDeleted;
  await context.route('**/api/**',async route=>{
   const url=new URL(route.request().url());
   const scope=url.searchParams.get('scope');
   const body=url.pathname==='/api/bootstrap'?{hasUsers:!deleted,tenantExists:!deleted,requestedSlug:'audit',settings:fixture.settings}:scope==='sales'?{sales:fixture.sales,nextCursor:''}:scope==='ledger'?{ledger:fixture.ledger,nextCursor:''}:scope==='audit'?{auditLogs:[]}:{db:fixture,currentUser:fixture.users[0]};
   await route.fulfill({json:body});
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173/audit#/patients');
  if(!initiallyDeleted) {
   await page.waitForSelector('.topbar');
   await page.waitForTimeout(250);
   deleted=true;
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  }
  try { await page.waitForFunction(()=>!document.querySelector('.topbar')&&localStorage.getItem('rxledger-session-active')===null); } catch(error) {console.log(await page.evaluate(()=>({visibility:document.visibilityState,token:localStorage.getItem('rxledger-session-active'),text:document.body.innerText.slice(0,200)})),errors);throw error;}
  assert.equal(await page.evaluate(()=>localStorage.getItem('rxledger:audit:admin:notification-dismissals')),null);
  assert.equal(await page.evaluate(()=>localStorage.getItem('rxledger:demo:demo-user:settings')),'keep');
  assert.equal(await page.getByText('Jane Patient',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(initiallyDeleted?'Deleted-workspace refresh clears scoped browser data':'Open workspace clears cached screen on deletion detection');
 }
} finally {await browser.close();}
