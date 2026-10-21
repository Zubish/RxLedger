import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import source from './fixtures/ux-database.mjs';
import {isolatedApi} from './helpers/isolated-api.mjs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const base=process.env.RXLEDGER_AUDIT_URL || 'http://localhost:5173';
mkdirSync('artifacts/staff-access',{recursive:true});
try{for(const width of [390,1440]){
 const db=structuredClone(source);db.posDrafts=[];db.continuityRequests=[];db.batches.forEach(batch=>batch.expiryDate='2099-01-01');db.ledger=db.batches.map(batch=>({id:'in-'+batch.id,batchId:batch.id,medicineId:batch.medicineId,quantity:25,type:'stock-in',reason:'Synthetic',reference:'SYNTHETIC',createdAt:new Date().toISOString(),userId:'admin'}));
 const api=await isolatedApi(db,'audit','admin');const errors=[];const contexts=[];
 async function open(token,path){const context=await browser.newContext({viewport:{width,height:1000}});contexts.push(context);await context.addInitScript(()=>localStorage.setItem('rxledger-session-active','true'));
 await context.route('**/api/**',async route=>{const url=new URL(route.request().url());if(!['/api/bootstrap','/api/state','/api/action'].includes(url.pathname)){await route.fulfill({status:204});return;}const body=route.request().method()==='POST'?route.request().postDataJSON():undefined;const result=await api.invoke(url.pathname+url.search,body,{token});await route.fulfill({status:result.code,json:result.body});});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'/audit#/'+path);await page.locator('.workspace').waitFor();const skip=page.locator('.quest-coach-head button').filter({hasText:'Skip'});if(await skip.isVisible())await skip.click();return page;}
 try{
 const owner=await open(api.session.token,'users');await owner.getByRole('button',{name:'Manage access',exact:true}).click();
 await owner.screenshot({path:`artifacts/staff-access/users-${width}.png`,fullPage:true});
 let dialog=owner.getByRole('dialog',{name:'Manage access for Alex Pharmacist'});await dialog.waitFor();
 await dialog.getByLabel('Start from a role',{exact:true}).selectOption('cashier');
 await dialog.getByLabel('Job title',{exact:true}).fill('Weekend cashier');
 const inventory=dialog.locator('details').filter({has:owner.locator('summary').filter({hasText:/^Inventory/})});await inventory.locator('summary').click();
 assert.equal(await dialog.getByRole('checkbox',{name:'Receive stock',exact:true}).isChecked(),false);
 const pricing=dialog.locator('details').filter({has:owner.locator('summary').filter({hasText:/^Pricing/})});await pricing.locator('summary').click();assert.equal(await dialog.getByRole('checkbox',{name:'View costs',exact:true}).isChecked(),false);
 const restrictions=dialog.locator('details').filter({has:owner.locator('summary').filter({hasText:/^Individual restrictions/})});await restrictions.locator('summary').click();await dialog.getByRole('checkbox',{name:'Disable: Complete sales',exact:true}).check();
 await dialog.getByLabel('Reason for this change',{exact:true}).fill('Weekend till preparation only');
 await owner.screenshot({path:`artifacts/staff-access/editor-${width}.png`,fullPage:true});
 await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await dialog.waitFor({state:'hidden'});
 let user=(await api.read()).users.find(user=>user.id==='staff');assert.equal(user.accessPolicy.title,'Weekend cashier');assert.ok(user.accessPolicy.denied.includes('sales.complete'));assert.ok(!user.accessPolicy.permissions.includes('pricing.cost'));
 const staffToken=(await api.shared.createSession('staff')).token;const staff=await open(staffToken,'pos');await staff.locator('.pos-redesign').waitFor();
 await staff.getByPlaceholder('Search product, batch or scan barcode...').fill('Amoxicillin');await staff.locator('.pos-catalog-card').first().click();
 assert.equal(await staff.getByRole('button',{name:'Complete sale',exact:true}).isEnabled(),false);
 assert.ok(!(await staff.locator('.nav-list').innerText()).includes('Receive'));
 await staff.screenshot({path:`artifacts/staff-access/restricted-pos-${width}.png`,fullPage:true});
 // Direct navigation must obey policy too.
 await staff.goto(base+'/audit#/receive');await staff.waitForFunction(()=>location.hash==='#/dashboard');
 // A reopened editor preserves restrictions when a different role is selected.
 await owner.getByRole('button',{name:'Manage access',exact:true}).click();dialog=owner.getByRole('dialog',{name:'Manage access for Alex Pharmacist'});await dialog.getByLabel('Start from a role',{exact:true}).selectOption('pharmacist');
 const restrictAgain=dialog.locator('details').filter({has:owner.locator('summary').filter({hasText:/^Individual restrictions/})});await restrictAgain.locator('summary').click();assert.ok(await dialog.getByRole('checkbox',{name:'Disable: Complete sales',exact:true}).isChecked());
 const template=dialog.locator('details').filter({has:owner.locator('summary').filter({hasText:'Save as a reusable role template'})});await template.locator('summary').click();await dialog.getByLabel('Template name',{exact:true}).fill('Weekend pharmacist');await dialog.getByRole('button',{name:'Save role template',exact:true}).click();await owner.waitForFunction(()=>document.body.innerText.includes('Role template saved'));
 assert.equal((await api.read()).staffRoles[0].name,'Weekend pharmacist');
 await dialog.getByLabel('Template name',{exact:true}).fill('Weekend pharmacist');await dialog.getByRole('button',{name:'Save role template',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'already uses this name'}).waitFor();
 await dialog.getByLabel('Reason for this change',{exact:true}).fill('Expanded duties; checkout restriction retained');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await dialog.waitFor({state:'hidden'});
 user=(await api.read()).users.find(user=>user.id==='staff');assert.ok(user.accessPolicy.denied.includes('sales.complete'));
 // API refresh in an existing session picks up changed access and clears revoked controls.
 await staff.goto(base+'/audit#/pos');await staff.locator('.pos-redesign').waitFor();
 const updated=await api.action('saveStaffAccess',{userId:'staff',expectedRevision:user.accessRevision,title:'Stock observer',role:'viewer',permissions:['inventory.view'],denied:[],branchIds:['a'],expiresAt:'',reason:'Synthetic revoke'});assert.equal(updated.code,200);
 await staff.evaluate(()=>window.dispatchEvent(new Event('focus')));await staff.waitForFunction(()=>!document.querySelector('.nav-list')?.textContent.includes('POS'));
 await staff.waitForFunction(()=>location.hash==='#/dashboard');
 assert.ok(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await staff.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log(`Staff access browser → API → PostgreSQL passed ${width}px: presets, restrictions, templates, save, direct-route guard and session refresh.`);
 }finally{for(const context of contexts)await context.close();await api.close();}
}}finally{await browser.close();}
