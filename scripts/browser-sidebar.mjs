import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import db from './fixtures/ux-database.mjs';
const base=process.env.RXLEDGER_AUDIT_URL||'http://localhost:5173';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
mkdirSync('artifacts/sidebar',{recursive:true});
try {
 for(const width of [320,390,768,1024,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});
 await context.addInitScript(()=>localStorage.setItem('rxledger-session-active','true'));
 await context.route('**/api/**',async route=>{const u=new URL(route.request().url());const scope=u.searchParams.get('scope');await route.fulfill({json:u.pathname==='/api/bootstrap'?{hasUsers:true,tenantExists:true,settings:db.settings}:scope==='sales'?{sales:db.sales,nextCursor:''}:scope==='ledger'?{ledger:db.ledger,nextCursor:''}:{db,currentUser:db.users[0]}})});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/audit#/dashboard');await page.locator('.topbar').waitFor();
 const skip=page.locator('.quest-coach-head button').filter({hasText:'Skip'});if(await skip.isVisible())await skip.click();
 assert.equal(await page.locator('.drawer-handle').count(),0);
 const trigger=page.locator('.sidebar-trigger');const panel=page.locator('.sidebar');
 if(width>900){
 assert.equal(await panel.evaluate(e=>e.inert),false);
 assert.equal(Math.round((await panel.boundingBox()).width),72);
 assert.equal(await panel.getByRole('button',{name:'Patients',exact:true}).isVisible(),true);
 await panel.getByRole('button',{name:'Patients',exact:true}).click();
 await page.getByRole('heading',{name:'Patients',exact:true}).waitFor();
 await trigger.click();assert.ok((await panel.boundingBox()).width>200);
 await panel.getByRole('button',{name:'Close control panel'}).click();
 assert.equal(Math.round((await panel.boundingBox()).width),72);
 await panel.getByRole('button',{name:'Continuity',exact:true}).click();
 await page.locator('#continuity-submenu').waitFor({state:'visible'});
 await page.screenshot({path:`artifacts/sidebar/expanded-${width}.png`});
 await trigger.click();
 await panel.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('heading',{name:'Account Settings',exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'Account Settings',exact:true}).waitFor();
 await panel.getByRole('button',{name:'Patients',exact:true}).click();
 await page.getByRole('heading',{name:'Patients',exact:true}).waitFor();
 await page.goBack();await page.getByRole('heading',{name:'Account Settings',exact:true}).waitFor();
 await page.goForward();await page.getByRole('heading',{name:'Patients',exact:true}).waitFor();
 } else {
 assert.equal(await panel.evaluate(e=>e.inert),true);
 await trigger.click();assert.equal(await panel.getAttribute('role'),'dialog');
 await page.keyboard.press('Escape');assert.equal(await panel.evaluate(e=>e.inert),true);
 await trigger.click();await panel.getByRole('button',{name:'Patients',exact:true}).click();
 await page.getByRole('heading',{name:'Patients',exact:true}).waitFor();
 assert.equal(await panel.evaluate(e=>e.inert),true);
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);await page.screenshot({path:`artifacts/sidebar/collapsed-${width}.png`});
 console.log('Sidebar navigation passed',width);await context.close();
 }
} finally {await browser.close();}
