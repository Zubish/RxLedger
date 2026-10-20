import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import source from './fixtures/ux-database.mjs';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const base=process.env.RXLEDGER_AUDIT_URL||'http://localhost:5173';
mkdirSync('artifacts/patient-details',{recursive:true});
try {for(const width of [390,1440]) {
 const db=structuredClone(source);let saved;
 const context=await browser.newContext({viewport:{width,height:1000}});
 await context.addInitScript(()=>localStorage.setItem('rxledger-session-active','true'));
 await context.route('**/api/**',async route=>{
  const url=new URL(route.request().url());const scope=url.searchParams.get('scope');
  const body=url.pathname==='/api/bootstrap'?{hasUsers:true,tenantExists:true,settings:db.settings}:scope==='sales'?{sales:db.sales,nextCursor:''}:scope==='ledger'?{ledger:db.ledger,nextCursor:''}:{db,currentUser:db.users[0]};
  if(url.pathname==='/api/action') {
   saved=route.request().postDataJSON();
   if(saved.action==='updatePatientProfile') for(const sale of db.sales)if(sale.customerPhone===saved.payload.oldPatientPhone){sale.customerName=saved.payload.patientName;sale.customerPhone=saved.payload.patientPhone;sale.patientDetails={...saved.payload.patientDetails,updatedAt:new Date().toISOString()};}
   if(saved.action==='savePosDraft') db.posDrafts=[{...saved.payload,id:'details-draft',userId:db.users[0].id,bookingCode:'DEMO',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()}];
   body.databasePatch=Object.fromEntries(['sales','ledger','auditLogs'].map(key=>[key,{upserts:db[key],removedIds:[]}]));
  }
  await route.fulfill({json:body});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/audit#/patients');await page.locator('.patient-profile-header').waitFor();
 const skip=page.locator('.quest-coach-head button').filter({hasText:'Skip'});if(await skip.isVisible())await skip.click();
 await page.locator('.patient-list-item').filter({hasText:'Jane Patient'}).click();
 assert.match(await page.locator('.patient-allergy-notice').innerText(),/not recorded.*Ask the patient/s);
 await page.getByRole('button',{name:'Edit profile',exact:true}).click();
 await page.getByRole('spinbutton',{name:/Age \(years\)/}).fill('36');
 await page.getByLabel(/^Gender/).selectOption('female');
 const fields=page.locator('.patient-profile-edit .patient-details-fields');
 assert.equal(await page.getByLabel('Specific allergy and reaction',{exact:true}).isVisible(),true);
 if(width>900){
  const controls=await fields.locator('input,select').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().top));
  assert.ok(Math.max(...controls)-Math.min(...controls)<2,'Age, gender and allergy status must align');
 }
 await page.getByLabel('Specific allergy and reaction',{exact:true}).fill('Penicillin: rash');
 assert.equal(await page.getByLabel(/^Allergy status/).inputValue(),'recorded');
 await page.screenshot({path:`artifacts/patient-details/edit-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.patient-allergy-notice')?.textContent.includes('Penicillin: rash'));
 assert.equal(saved.payload.patientDetails.age,36);
 await page.reload();await page.locator('.patient-profile-header').waitFor();
 await page.locator('.patient-list-item').filter({hasText:'Jane Patient'}).click();
 assert.match(await page.locator('.patient-allergy-notice').innerText(),/Penicillin: rash/);
 assert.match(await page.locator('.patient-demographics').innerText(),/36.*female/);
 await page.screenshot({path:`artifacts/patient-details/profile-${width}.png`,fullPage:true});
 await page.goto(base+'/audit#/pos');await page.locator('#pos-customer-name').waitFor();
 await page.locator('#pos-customer-name').fill('Jane');
 await page.locator('.pos-patient-suggestions button').first().click();
 assert.match(await page.locator('.patient-allergy-notice').innerText(),/Penicillin: rash/);
 assert.equal(await page.locator('.complete').innerText(),'Complete sale');
 assert.equal(await page.locator('.pos-patient-demographics').innerText(),'36, F');
 assert.equal(await page.locator('.pos-patient-details').count(),0);
 assert.equal(await page.getByLabel('Specific allergy and reaction',{exact:true}).count(),0);
 const badge=await page.locator('.pos-patient-demographics').boundingBox();
 const card=await page.locator('.pos-patient-snapshot').boundingBox();
 assert.ok(card.x+card.width-(badge.x+badge.width)<20,'Demographics stay in the card right corner');
 assert.ok((await page.locator('.pos-allergy-summary').boundingBox()).height<100,'Allergy summary stays compact');
 await page.getByPlaceholder('Search product, batch or scan barcode...').fill('Amoxicillin');
 await page.locator('.pos-catalog-card').first().click();
 await page.locator('.pos-action-row').getByRole('button',{name:'Draft',exact:true}).click();
 await page.waitForTimeout(200);
 assert.equal(saved.action,'savePosDraft');assert.equal(saved.payload.patientDetails.age,36);assert.equal(saved.payload.patientDetails.allergyStatus,'recorded');
 await page.reload();await page.locator('#pos-customer-phone').waitFor();
 assert.equal(await page.locator('#pos-customer-phone').inputValue(),'08012345678');
 assert.match(await page.locator('.patient-allergy-notice').innerText(),/Penicillin: rash/);
 await page.screenshot({path:`artifacts/patient-details/pos-compact-${width}.png`,fullPage:true});
 await page.locator('#pos-customer-phone').fill('08099999999');
 assert.match(await page.locator('.patient-allergy-notice').innerText(),/Not recorded — ask patient/);
 assert.equal(await page.locator('.patient-allergy-notice').innerText().then(t=>t.includes('Penicillin')),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('Patient details save, refresh, POS selection and allergy states passed',width);
 await context.close();
}}finally{await browser.close();}
