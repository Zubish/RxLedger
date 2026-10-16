import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fixture from './fixtures/ux-database.mjs';
import {mkdirSync} from 'node:fs';
const base=process.env.RXLEDGER_AUDIT_URL||'http://localhost:5173';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
mkdirSync('artifacts/pricing',{recursive:true});
try {
 for(const width of [390,1440]){
  const db=structuredClone(fixture);db.settings.globalMarkupPercent=30;db.settings.pricingRoundingRule=25;
  db.settings.autoPricingEnabled=false;
  for(const m of db.medicines){m.costPrice=1000;m.sellingPrice=1200;m.packSize=28;m.unit='Pack';m.sellableUnit='Tablet';}
  let saved;
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.addInitScript(()=>localStorage.setItem('rxledger-session-active','true'));
  await context.route('**/api/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/action'){
    const body=route.request().postDataJSON();
    if(body.action==='updateSettings'){saved=body.payload;Object.assign(db.settings,saved);}
   }
   await route.fulfill({json:url.pathname==='/api/bootstrap'?{hasUsers:true,tenantExists:true,settings:db.settings}:{db,currentUser:db.users[0]}});
  });
  const page=await context.newPage();
  await page.goto(base+'/audit#/settings');await page.locator('.settings-page').waitFor();
  const skip=page.locator('.quest-coach-head button').filter({hasText:'Skip'});if(await skip.isVisible())await skip.click();
  assert.equal(await page.getByLabel('Round prices').inputValue(),'custom');
  await page.getByLabel('Custom rounding increment (NGN)').fill('75');
  await page.getByRole('button',{name:'Save settings',exact:true}).click();
  await page.waitForTimeout(250);assert.equal(saved?.pricingRoundingRule,75);
  await page.reload();await page.getByLabel('Custom rounding increment (NGN)').waitFor();
  assert.equal(await page.getByLabel('Custom rounding increment (NGN)').inputValue(),'75');
  await page.getByLabel('Round prices').selectOption('10');
  assert.equal(await page.getByLabel('Custom rounding increment (NGN)').count(),0);
  await page.goto(base+'/audit#/receive');await page.locator('.line-card').first().waitFor();
  const line=page.locator('.line-card').first();
  db.settings.pricingRoundingRule=0;
  await page.reload();await page.locator('.line-card').first().waitFor();
  await line.getByLabel('Cost per Pack',{exact:true}).fill('2800');
  await line.getByLabel(/^Selling price per Tablet/).fill('120');
  assert.match(await line.locator('.markup-warning').innerText(),/130.*per Tablet/);
  await line.getByLabel(/^Selling price per Tablet/).fill('130');
  assert.equal(await line.locator('.markup-warning').count(),0);
  db.settings.autoPricingEnabled=true;db.settings.pricingRoundingRule=25;
  await page.reload();await page.locator('.line-card').first().waitFor();
  await line.getByLabel('Cost per Pack',{exact:true}).fill('2800');
  assert.equal(await line.getByLabel(/^Selling price per Tablet/).inputValue(),'125');
  assert.equal(await line.getByLabel(/^Selling price per Tablet/).isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`artifacts/pricing/receive-${width}.png`,fullPage:true});
  console.log('Settings persistence, default medicine pack conversion, per-tablet warning and automatic pricing passed',width);
  await context.close();
 }
} finally {await browser.close();}
