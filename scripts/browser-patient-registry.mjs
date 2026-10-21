import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import source from './fixtures/ux-database.mjs';
import {isolatedApi} from './helpers/isolated-api.mjs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const base=process.env.RXLEDGER_AUDIT_URL || 'http://localhost:5173';
mkdirSync('artifacts/patient-registry',{recursive:true});
try {for(const width of [390,1440]) {
 const fixture=structuredClone(source);fixture.sales=[];fixture.posDrafts=[];fixture.continuityRequests=[];fixture.auditLogs=[];
 fixture.users.push({...fixture.users[1],id:'branch-b',branchIds:['b']});
 fixture.batches.forEach(batch=>batch.expiryDate='2099-01-01');
 fixture.ledger=fixture.batches.map(batch=>({id:`in-${batch.id}`,batchId:batch.id,medicineId:batch.medicineId,quantity:25,type:'stock-in',reason:'Synthetic receipt',reference:'SYNTHETIC',createdAt:new Date().toISOString(),userId:'staff'}));
 const api=await isolatedApi(fixture,'audit','staff');
 const contexts=[];const errors=[];
 async function open(token,path) {
  const context=await browser.newContext({viewport:{width,height:1000}});contexts.push(context);
  await context.addInitScript(()=>{localStorage.setItem('rxledger-session-active','true');window.open=()=>null;});
  await context.route('**/api/**',async route=>{
   const url=new URL(route.request().url());
   if(!['/api/bootstrap','/api/state','/api/action'].includes(url.pathname)){await route.fulfill({status:204});return;}
   const body=route.request().method()==='POST'?route.request().postDataJSON():undefined;
   const response=await api.invoke(url.pathname+url.search,body,{token});
   await route.fulfill({status:response.code,json:response.body});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/audit#/'+path);await page.locator('.workspace').waitFor();
  const skip=page.locator('.quest-coach-head button').filter({hasText:'Skip'});if(await skip.isVisible())await skip.click();
  return page;
 }
 const register=async(page,name,phone,age,allergies,reason)=>{
  await page.getByRole('button',{name:'Register patient',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Register workspace patient'});await dialog.waitFor();
  await dialog.getByLabel('Patient name',{exact:true}).fill(name);await dialog.getByLabel('Patient phone',{exact:true}).fill(phone);
  await dialog.getByRole('spinbutton',{name:'Age (years)',exact:true}).fill(String(age));
  await dialog.getByLabel(/^Gender/).selectOption('male');
  if(allergies)await dialog.getByLabel('Specific allergy and reaction',{exact:true}).fill(allergies);
  else await dialog.getByLabel('Allergy status',{exact:false}).selectOption('none');
  if(reason)await dialog.getByLabel('Reason this is a different person sharing the contact',{exact:true}).fill(reason);
  await page.screenshot({path:`artifacts/patient-registry/register-${width}.png`,fullPage:true});
  await dialog.getByRole('button',{name:'Register patient',exact:true}).click();await dialog.waitFor({state:'hidden'});
 };
 try {
  const a=await open(api.session.token,'patients');
  await register(a,'Ada Registry','08012345678',44,'Penicillin: rash');
  await a.locator('.patient-profile-header').filter({hasText:'Ada Registry'}).waitFor();
  let patient=(await api.read()).patients.find(record=>record.name==='Ada Registry');
  await a.goto(base+'/audit#/pos');await a.locator('#pos-customer-name').fill('Ada');
  await a.locator('.pos-patient-suggestions button').filter({hasText:'Ada Registry'}).click();
  await a.locator('.pos-patient-demographics').filter({hasText:'44, M'}).waitFor();
  assert.equal(await a.locator('.pos-patient-demographics').innerText(),'44, M');
  await a.getByPlaceholder('Search product, batch or scan barcode...').fill('Amoxicillin');await a.locator('.pos-catalog-card').first().click();
  await a.locator('.complete').click();await a.locator('.pos-checkout-status[data-phase="confirmed"]').waitFor();
  assert.equal((await api.read()).sales[0].patientId,patient.id);

  const bToken=(await api.shared.createSession('branch-b')).token;
  const b=await open(bToken,'pos');await b.locator('#pos-customer-phone').fill('+2348012345678');
  assert.equal((await b.locator('.patient-allergy-notice').innerText()).includes('Penicillin'),false,'Phone-only matching must wait for identity confirmation');
  await b.locator('.pos-patient-suggestions button').filter({hasText:'Ada Registry'}).click();
  await b.locator('.patient-allergy-notice').filter({hasText:'Penicillin: rash'}).waitFor();
  assert.equal(await b.locator('.pos-patient-demographics').innerText(),'44, M');
  assert.equal((await b.locator('.pos-patient-snapshot').innerText()).includes('Invalid Date'),false);
  await b.getByRole('button',{name:'Care history across branches',exact:true}).click();
  const history=b.getByRole('dialog',{name:'Care history across branches'});await history.waitFor();
  assert.match(await history.innerText(),/Amoxicillin/);assert.match(await history.innerText(),/Central Pharmacy/);assert.equal((await history.innerText()).includes('₦'),false);
  await b.keyboard.press('Escape');await history.waitFor({state:'hidden'});
  await b.screenshot({path:`artifacts/patient-registry/cross-branch-pos-${width}.png`,fullPage:true});
  await b.getByPlaceholder('Search product, batch or scan barcode...').fill('Amoxicillin');await b.locator('.pos-catalog-card').first().click();
  await b.locator('.pos-action-row').getByRole('button',{name:'Draft',exact:true}).click();await b.waitForTimeout(200);await b.reload();
  await b.locator('.pos-patient-snapshot').waitFor();assert.match(await b.locator('.patient-allergy-notice').innerText(),/Penicillin: rash/);
  assert.equal((await api.read()).posDrafts.find(draft=>draft.branchId==='b').patientId,patient.id);
  await b.goto(base+'/audit#/patients');await b.locator('.patient-profile-header').waitFor();
  await b.getByRole('button',{name:'Edit profile',exact:true}).click();await b.getByRole('spinbutton',{name:'Age (years)',exact:true}).fill('45');
  await b.getByLabel('Specific allergy and reaction',{exact:true}).fill('Penicillin: rash; Aspirin: wheeze');
  await b.getByRole('button',{name:'Save profile',exact:true}).click();await b.locator('.patient-profile-edit').waitFor({state:'hidden'});
  await a.goto(base+'/audit#/patients');await a.locator('.patient-profile-header').waitFor();
  await a.locator('.patient-allergy-notice').filter({hasText:'Aspirin: wheeze'}).waitFor();

  await register(b,'Child Registry','+2348012345678',8,'',"Parent's contact");
  await b.goto(base+'/audit#/pos');await b.locator('#pos-customer-name').fill('');await b.locator('#pos-customer-phone').fill('08012345678');
  assert.equal(await b.locator('.pos-patient-suggestions button').count(),2);
  await b.locator('.pos-patient-suggestions button').filter({hasText:'Child Registry'}).click();
  await b.locator('.patient-allergy-notice').filter({hasText:'No known allergies'}).waitFor();assert.equal((await b.locator('.patient-allergy-notice').innerText()).includes('Penicillin'),false);

  const alias=await api.action('createPatient',{branchId:'a',patientName:'Ada Alias',patientPhone:'08098765432'});assert.equal(alias.code,200);
  const ownerToken=(await api.shared.createSession('admin')).token;const owner=await open(ownerToken,'patients');
  await owner.getByPlaceholder('Search patient phone, name, or receipt...').fill('Ada Alias');await owner.locator('.patient-profile-header').filter({hasText:'Ada Alias'}).waitFor();
  await owner.getByRole('button',{name:'Review duplicate identity',exact:true}).click();
  const merge=owner.getByRole('dialog',{name:'Review patient identity merge'});await merge.waitFor();
  await merge.getByLabel('Keep this patient profile',{exact:true}).selectOption(patient.id);
  await merge.getByLabel('How identity was confirmed',{exact:true}).fill('Synthetic verified identity review');
  await merge.getByRole('checkbox').check();await merge.getByRole('button',{name:'Merge confirmed patient',exact:true}).click();await merge.waitFor({state:'hidden'});
  patient=(await api.read()).patients.find(record=>record.id===patient.id);
  assert.equal((await api.read()).patients.find(record=>record.id===alias.body.patient.id).mergedIntoId,patient.id);
  assert.match(patient.details.allergies,/Penicillin/);assert.match(patient.details.allergies,/Aspirin/);
  for(const page of [a,b,owner])assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);console.log(`Workspace patient registry browser → API → isolated PostgreSQL passed ${width}px: registration, cross-branch recognition, audited care, draft, profile edit, family selection and merge.`);
 } catch(error) {let index=0;for(const context of contexts)for(const page of context.pages())await page.screenshot({path:`artifacts/patient-registry/failure-${width}-${index++}.png`,fullPage:true});throw error;}
 finally {for(const context of contexts)await context.close();await api.close();}
}}finally{await browser.close();}
