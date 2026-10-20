import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import {resolve} from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

// Actual application handlers and SQL against an isolated PostgreSQL engine.
// Only the Neon transport and telemetry delivery are replaced. No remote data.
test('persisted API integrity: scope, reconciliation, allergy audit and concurrent saves', async t => {
 const postgres=new PGlite();
 const require=createRequire(resolve('package.json'));
 const previousUrl=process.env.DATABASE_URL;
 process.env.DATABASE_URL='postgresql://isolated.invalid/synthetic';
 const sql=async(strings,...values)=>{
  const query=strings.reduce((text,part,index)=>text+(index?`$${index}`:'')+part,'');
  return (await postgres.query(query,values)).rows;
 };
 const cache=new Map();
 function load(relative) {
  const filename=resolve(relative);
  if(cache.has(filename))return cache.get(filename).exports;
  const loaded=new Module(filename);cache.set(filename,loaded);
  loaded.require=name=>{
   if(name==='@neondatabase/serverless')return {neon:()=>sql};
   if(name.startsWith('.'))return load(resolve(filename,'..',name.replace(/\.js$/,'.ts')));
   return require(name);
  };
  loaded._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
  return loaded.exports;
 }
 try {
  const shared=load('server/_shared.ts');
  shared.trackApi=()=>{};shared.logApiPerformance=()=>{};
  const action=load('api/action.ts').default;
  const state=load('api/state.ts').default;
  await shared.ensureSchema();
  const db=shared.createEmptyDatabase();
  db.settings={...db.settings,primaryAdminId:'owner',autoPricingEnabled:true,globalMarkupPercent:30,pricingRoundingRule:0};
  db.branches=[{id:'a',name:'Synthetic A',active:true},{id:'b',name:'Synthetic B',active:true}];
  const staff={id:'staff',name:'Synthetic professional',role:'pharmacist',status:'active',branchIds:['a'],managedBranchIds:[],email:'synthetic@example.invalid',phone:'',createdAt:shared.nowIso()};
  db.users=[staff,{...staff,id:'owner',role:'admin'},{...staff,id:'viewer',role:'viewer'},{...staff,id:'suspended',status:'suspended'}];
  db.suppliers=[{id:'supplier',name:'Synthetic supplier'}];
  db.medicines=[{id:'m',sku:'M',brandName:'Synthetic medicine',genericName:'Example',category:'',nafdacNumber:'',active:true,packSize:28,costPrice:0,sellingPrice:0,barcodes:[]}];
  await shared.saveTenantDatabase('integrity-fixture',db,true);
  const other=shared.createEmptyDatabase();other.users=[{...staff,id:'other-owner',role:'admin'}];other.settings.primaryAdminId='other-owner';
  await shared.saveTenantDatabase('other-fixture',other,true);
  const session=await shared.createSession('staff');
  const viewer=await shared.createSession('viewer');
  const suspended=await shared.createSession('suspended');
  const expired=await shared.createSession('staff');
  await postgres.query("UPDATE sessions SET expires_at=now()-interval '1 minute' WHERE token_hash=$1",[shared.hashToken(expired.token)]);
  async function request(handler,{action:actionName,payload,slug='integrity-fixture',token=session.token,query={}}={}) {
   if(actionName==='recordSale') payload={operationId:randomUUID(),...payload};
   const req={method:handler===action?'POST':'GET',headers:{'x-rxledger-company':slug,authorization:`Bearer ${token}`},body:{action:actionName,payload},query};
   const res={code:200,body:null,status(code){this.code=code;return this;},json(body){this.body=body;},setHeader(){}};
   await handler(req,res);return res;
  }
  const receiving={branchId:'a',supplierId:'supplier',items:[{itemId:'m',quantity:1,unitCost:2800,batchNumber:'SYNTHETIC',expiryDate:'2099-01-01'}]};
  const salePayload={branchId:'a',customerName:'Synthetic patient',customerPhone:'08000000001',items:[{itemId:'m',quantity:10,itemType:'medicine'}],paymentMethod:'cash'};
  await t.test('direct API blocks foreign workspace, branch, viewer and suspended session writes',async()=>{
   for(const options of [{slug:'other-fixture'},{token:suspended.token},{token:'expired-or-invalid'},{token:expired.token}]) {
    assert.equal((await request(state,options)).code,401);
    assert.equal((await request(action,{...options,action:'receiveStock',payload:receiving})).code,401);
   }
   assert.equal((await request(action,{token:viewer.token,action:'receiveStock',payload:receiving})).code,400);
   assert.equal((await request(action,{action:'receiveStock',payload:{...receiving,branchId:'b'}})).code,400);
   const untouched=await shared.loadTenantDatabase('integrity-fixture');assert.equal(untouched.ledger.length,0);
  });
  await t.test('receive and sale persist matching least-unit stock, prices, totals and ledger',async()=>{
   assert.equal((await request(action,{action:'receiveStock',payload:receiving})).code,200);
   let stored=await shared.loadTenantDatabase('integrity-fixture');
   assert.equal(stored.batches[0].unitCost,100);assert.equal(stored.medicines[0].sellingPrice,130);
   assert.equal(stored.ledger.reduce((sum,row)=>sum+row.quantity,0),28);
   assert.equal((await request(action,{action:'recordSale',payload:salePayload})).code,200);
   stored=await shared.loadTenantDatabase('integrity-fixture');
   assert.equal(stored.sales[0].total,1300);assert.equal(stored.stockSnapshot[0].quantity,18);
   assert.equal(stored.ledger.reduce((sum,row)=>sum+row.quantity,0),18);
   const before=(await postgres.query("SELECT data FROM tenant_state WHERE slug='integrity-fixture'")).rows[0].data;
   assert.equal((await request(action,{action:'recordSale',payload:{...salePayload,items:[{itemId:'m',quantity:10},{itemId:'m',quantity:10}]}})).code,400);
   assert.deepEqual((await postgres.query("SELECT data FROM tenant_state WHERE slug='integrity-fixture'")).rows[0].data,before);
  });
  await t.test('allergy correction persists and is audited; stale checkout cannot erase it',async()=>{
   const details={age:44,gender:'male',allergyStatus:'recorded',allergies:'Penicillin: rash'};
   assert.equal((await request(action,{action:'updatePatientProfile',payload:{branchId:'a',oldPatientPhone:salePayload.customerPhone,patientName:'Synthetic patient',patientPhone:salePayload.customerPhone,patientDetails:details}})).code,200);
   let stored=await shared.loadTenantDatabase('integrity-fixture');
   const audit=stored.auditLogs.find(row=>row.entity==='patient-profile');
   assert.equal(audit.after.patientDetails.allergies,details.allergies);
   assert.equal(audit.before.matchingSales[0].patientDetails,undefined);
   assert.equal((await request(action,{action:'recordSale',payload:{...salePayload,patientDetails:{allergyStatus:'none',allergies:''}}})).code,200);
   stored=await shared.loadTenantDatabase('integrity-fixture');
   assert.equal(stored.sales[0].patientDetails.allergies,details.allergies);
   assert.equal(stored.stockSnapshot[0].quantity,8);
  });
  await t.test('consumed draft replay and invalid stock adjustment cannot create extra movements',async()=>{
   assert.equal((await request(action,{action:'savePosDraft',payload:{...salePayload,items:[{itemId:'m',quantity:1,itemType:'medicine'}]}})).code,200);
   const draftId=(await shared.loadTenantDatabase('integrity-fixture')).posDrafts[0].id;
   const checkout={...salePayload,draftId,items:[{itemId:'m',quantity:1,itemType:'medicine'}]};
   assert.equal((await request(action,{action:'recordSale',payload:checkout})).code,200);
   const before=(await postgres.query("SELECT data FROM tenant_state WHERE slug='integrity-fixture'")).rows[0].data;
   assert.equal((await request(action,{action:'recordSale',payload:checkout})).code,400);
   const batchId=before.batches[0].id;
   assert.equal((await request(action,{action:'adjustStock',payload:{batchId,mode:'write-off',quantity:-4,reason:'Synthetic invalid adjustment'}})).code,400);
   assert.deepEqual((await postgres.query("SELECT data FROM tenant_state WHERE slug='integrity-fixture'")).rows[0].data,before);
   assert.equal((await request(action,{action:'adjustStock',payload:{batchId,mode:'customer-return',quantity:2,reason:'Synthetic physical return'}})).code,200);
   assert.equal((await request(action,{action:'issueStock',payload:{branchId:'a',medicineId:'m',quantity:2}})).code,200);
   assert.equal((await shared.loadTenantDatabase('integrity-fixture')).stockSnapshot[0].quantity,7);
  });
  await t.test('state and history responses exclude another branch; revoked access takes effect',async()=>{
   const stored=await shared.loadTenantDatabase('integrity-fixture');
   stored.sales.push({...stored.sales[0],id:'foreign-sale',branchId:'b',customerName:'Foreign synthetic patient'});
   await shared.saveTenantDatabase('integrity-fixture',stored);
   const visible=await request(state);assert.equal(visible.code,200);
   assert.ok(visible.body.db.sales.every(row=>row.branchId==='a'));
   const history=await request(state,{query:{scope:'sales'}});assert.equal(history.code,200);
   assert.ok(history.body.sales.every(row=>row.branchId==='a'));
   const revoked=await shared.loadTenantDatabase('integrity-fixture');revoked.users.find(row=>row.id==='staff').branchIds=[];
   await shared.saveTenantDatabase('integrity-fixture',revoked);
   const restricted=await request(state);assert.equal(restricted.code,200);assert.equal(restricted.body.db.sales.length,0);
   assert.equal((await request(action,{action:'recordSale',payload:salePayload})).code,400);
  });
  await t.test('atomic PostgreSQL comparison rejects stale writes, even at microsecond precision',async()=>{
   const one=await shared.loadTenantDatabase('integrity-fixture');
   const two=await shared.loadTenantDatabase('integrity-fixture');
   one.settings.accountName='Winner';two.settings.accountName='Stale';
   const results=await Promise.allSettled([shared.saveTenantDatabase('integrity-fixture',shared.withReadModels(one)),shared.saveTenantDatabase('integrity-fixture',shared.withReadModels(two))]);
   assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
   assert.match(results.find(result=>result.status==='rejected').reason.message,/workspace changed/);
   const saved=await shared.loadTenantDatabase('integrity-fixture');
   assert.equal(saved.sales.length,4);assert.equal(saved.stockSnapshot[0].quantity,7);
   assert.equal(saved.sales[0].patientDetails.allergies,'Penicillin: rash');
   assert.deepEqual(saved.users.find(row=>row.id==='staff').branchIds,[]);
   assert.equal((await shared.loadTenantDatabase('other-fixture')).users[0].id,'other-owner');
  });
 } finally {
  await postgres.close();
  if(previousUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousUrl;
 }
});
