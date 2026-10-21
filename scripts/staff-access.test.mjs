import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import source from './fixtures/ux-database.mjs';
import {isolatedApi} from './helpers/isolated-api.mjs';
import {loadServerModule} from './helpers/load-server-module.mjs';
const {rolePresets,defaultPermissions,addPermission,removePermission,effectivePermissions}=loadServerModule('src/accessPolicy.ts');

test('permission dependencies and personal denials never broaden grants',()=>{
 const full=addPermission([],'sales.complete');assert.ok(full.includes('patients.view'));assert.ok(full.includes('inventory.view'));
 const restricted=effectivePermissions({role:'pharmacist',managedBranchIds:[],accessPolicy:{permissions:full,denied:['patients.view'],revision:1,title:'Custom'}});
 assert.ok(!restricted.includes('sales.prepare'));assert.ok(!restricted.includes('sales.complete'));
 assert.ok(!removePermission(addPermission([],'reports.margin'),'pricing.cost').includes('reports.margin'));
});
test('staff access: actual API/PostgreSQL permissions and payload boundaries',async t=>{
 const fixture=structuredClone(source);fixture.posDrafts=[];fixture.continuityRequests=[];
 fixture.batches.forEach(batch=>batch.expiryDate='2099-01-01');
 fixture.ledger=fixture.batches.map(batch=>({id:`in-${batch.id}`,batchId:batch.id,medicineId:batch.medicineId,quantity:25,type:'stock-in',reason:'Synthetic receipt',reference:'SYNTHETIC',createdAt:new Date().toISOString(),userId:'admin'}));
 fixture.users[1].passwordHash='synthetic-private-password-hash';fixture.users[1].passwordSalt='synthetic-private-salt';
 const api=await isolatedApi(fixture,'access','admin');const staff=(await api.shared.createSession('staff')).token;
 const day=new Date().toISOString().slice(0,10);
 const state=()=>api.invoke('/api/state',undefined,{token:staff});
 const input=async(permissions,extra={})=>({userId:'staff',title:'Custom staff',role:'pharmacist',permissions,denied:[],branchIds:['a'],expiresAt:'',reason:'Owner approved synthetic work duties',expectedRevision:(await api.read()).users.find(u=>u.id==='staff').accessRevision || 0,...extra});
 const sale=()=>({operationId:randomUUID(),branchId:'a',paymentMethod:'cash',discount:0,items:[{itemType:'medicine',itemId:'m1',quantity:1}]});
 try{
  await t.test('migration is additive and preserves existing access until explicitly saved',async()=>{
   const before=await state();assert.equal(before.code,200);assert.ok(!JSON.stringify(before.body).includes('synthetic-private'));
   const bootstrap=await api.invoke('/api/bootstrap');assert.ok(!('globalMarkupPercent' in bootstrap.body.settings));assert.equal(before.body.currentUser.accessPolicy,undefined);assert.equal(before.body.db.batches.find(b=>b.id==='m1a').unitCost,100);
   const db=await api.read();const normalized=api.shared.normalizeDatabase(db);assert.equal(normalized.users.find(u=>u.id==='staff').accessPolicy,undefined);
  });
  await t.test('owner saves preset/custom permissions; denied receiving and pricing cannot bypass API',async()=>{
   let permissions=defaultPermissions((await api.read()).users.find(u=>u.id==='staff'));
   permissions=removePermission(permissions,'inventory.receive');permissions=removePermission(permissions,'pricing.cost');
   const result=await api.action('saveStaffAccess',await input(permissions));assert.equal(result.code,200,result.body.error);
   const current=(await state()).body;assert.equal(current.currentUser.accessPolicy.revision,1);assert.ok(current.db.batches.every(b=>b.unitCost===0));assert.ok(current.db.medicines.every(m=>m.costPrice===0));assert.ok(current.db.products.every(p=>p.costPrice===0));
   assert.equal((await api.action('receiveStock',{branchId:'a'},{token:staff})).code,400);
   assert.equal((await api.action('updateSellingPrice',{branchId:'a',medicineId:'m1',sellingPrice:1},{token:staff})).code,400);
   const sold=await api.action('recordSale',sale(),{token:staff});assert.equal(sold.code,200,sold.body.error);assert.ok(sold.body.checkout.sale.items.every(i=>i.unitCost===undefined));assert.ok(sold.body.databasePatch.sales.upserts.every(s=>s.items.every(i=>i.unitCost===undefined)));
   const stored=await api.read();assert.ok(stored.sales.find(s=>s.id===sold.body.checkout.sale.id).items.every(i=>i.unitCost===100),'Stored costs preserved');
   const history=await api.invoke('/api/state?scope=sales',undefined,{token:staff});assert.equal(history.code,200);assert.ok(history.body.sales.length>0);assert.ok(history.body.sales.every(s=>s.items.every(i=>i.unitCost===undefined)));
   const ledger=await api.invoke('/api/state?scope=ledger',undefined,{token:staff});assert.equal(ledger.code,200);assert.ok(ledger.body.ledger.length>0);assert.ok(ledger.body.ledger.every(e=>e.unitCost===undefined));
   const financial=await api.invoke(`/api/state?scope=financial&start=${day}&end=${day}`,undefined,{token:staff});assert.equal(financial.code,200);assert.ok(financial.body.rows.every(r=>r.cost===null&&r.grossMargin===null));
  });
  await t.test('individual restrictions override presets, including dependent checkout actions',async()=>{
   const result=await api.action('saveStaffAccess',await input(rolePresets[0].permissions,{denied:['sales.complete','reports.export','patients.care']}));assert.equal(result.code,200);
   assert.equal((await api.action('recordSale',sale(),{token:staff})).code,400);
   assert.equal((await api.action('getPatientCareHistory',{branchId:'a',patientId:'invented'},{token:staff})).code,400);
   assert.equal((await api.invoke('/api/state?scope=financial&export=1',undefined,{token:staff})).code,403);
   const draft=await api.action('savePosDraft',sale(),{token:staff});assert.equal(draft.code,200,draft.body.error);
  });
  await t.test('restricted patient and financial history cannot leak through state, pagination or mutation responses',async()=>{
   const permissions=['inventory.view','sales.history'];assert.equal((await api.action('saveStaffAccess',await input(permissions))).code,200);
   const page=(await api.invoke('/api/state?scope=sales',undefined,{token:staff})).body;
   assert.ok(page.sales.length);assert.ok(page.sales.every(s=>!s.customerName&&!s.customerPhone&&!s.patientDetails&&!s.patientRiskContext&&s.items.every(i=>!i.unitCost&&!i.labelInstruction)));
   const result=await api.action('refreshStaffAccess',{}, {token:staff});assert.equal(result.code,200);assert.deepEqual(result.body.db.patients,[]);assert.deepEqual(result.body.db.continuityRequests,[]);
   assert.equal((await api.invoke('/api/state?scope=financial',undefined,{token:staff})).code,403);
   assert.equal((await api.action('getRegistryPatient',{branchId:'a',patientId:'unknown'},{token:staff})).code,400);
   assert.equal((await api.action('saveStaffAccess',await input([]),{token:staff})).code,400);
  });
  await t.test('unknown permissions, absent dependencies, stale saves and owner lockout are rejected atomically',async()=>{
   const before=(await api.read()).users.find(u=>u.id==='staff');
   for(const patch of [{permissions:['invented']},{permissions:['sales.complete']},{reason:''},{expectedRevision:0},{role:'cashier',permissions:addPermission([],'patients.care')},{userId:'admin'}]){
    const result=await api.action('saveStaffAccess',await input([],patch));assert.equal(result.code,400,JSON.stringify(patch));
   }
   assert.deepEqual((await api.read()).users.find(u=>u.id==='staff'),before);
   const revision=before.accessRevision;assert.equal((await api.action('updateBranchAccess',{userId:'staff',branchId:'b',canAccess:true})).code,200);
   assert.equal((await api.action('saveStaffAccess',await input([],{expectedRevision:revision}))).code,400);
  });
  await t.test('custom grants still need active branch access; templates do not silently alter assignments',async()=>{
   assert.equal((await api.action('saveStaffAccess',await input(rolePresets[2].permissions,{role:'inventory',branchIds:[]}))).code,200);
   assert.equal((await api.action('upsertSupplier',{record:{name:'No branch'}},{token:staff})).code,400);
   const userBefore=structuredClone((await api.read()).users.find(u=>u.id==='staff'));
   const template=await api.action('saveStaffRole',{name:'Weekend stock team',description:'Synthetic role',role:'inventory',permissions:rolePresets[2].permissions});assert.equal(template.code,200,template.body.error);
   assert.deepEqual((await api.read()).users.find(u=>u.id==='staff'),userBefore);
   assert.equal((await api.read()).staffRoles.length,1);
   assert.ok((await api.read()).auditLogs.some(a=>a.action==='Updated staff permissions'&&a.after.reason));
   assert.ok((await api.read()).auditLogs.some(a=>a.action==='Created staff role template'));
   await api.action('updateUser',{userId:'staff',updates:{status:'active'}});assert.deepEqual((await api.read()).users.find(u=>u.id==='staff').branchIds,[]);const audit=await api.invoke('/api/state?scope=audit');assert.ok(!JSON.stringify(audit.body).includes('synthetic-private'));
   assert.ok(!(await api.read()).auditLogs.filter(a=>a.action==='Updated staff permissions'||a.action==='Updated user access').some(a=>JSON.stringify(a).includes('synthetic-private')));
  });
  await t.test('catalogue edits cannot bypass price or stock correction restrictions; receiving respects manual pricing access',async()=>{
   assert.equal((await api.action('saveStaffAccess',await input(addPermission([],'inventory.catalogue'),{role:'inventory'}))).code,200);
   let db=await api.read();const medicine=db.medicines.find(item=>item.id==='m1'),product=db.products[0];
   const edited=await api.action('upsertMedicine',{branchId:'a',record:{...medicine,brandName:'Reviewed catalogue name',costPrice:0,sellingPrice:1}},{token:staff});assert.equal(edited.code,200,edited.body.error);
   assert.equal((await api.read()).medicines.find(item=>item.id==='m1').sellingPrice,medicine.sellingPrice);
   const retail=await api.action('upsertProduct',{branchId:'a',record:{...product,quantity:0,costPrice:0,sellingPrice:1}},{token:staff});assert.equal(retail.code,200,retail.body.error);
   assert.equal((await api.read()).products[0].sellingPrice,product.sellingPrice);
   assert.equal((await api.action('upsertProduct',{branchId:'a',record:{...product,quantity:1}},{token:staff})).code,400);
   assert.equal((await api.action('saveStaffAccess',await input(addPermission([],'inventory.receive'),{role:'inventory'}))).code,200);
   const receive={branchId:'a',supplierId:'supplier',reference:'ACCESS-RECEIVE',items:[{itemType:'medicine',medicineId:'m1',quantity:1,batchNumber:'ACCESS-1',expiryDate:'2099-01-01',unitCost:1000,sellingPrice:250,location:'Shelf'}]};
   assert.equal((await api.action('receiveStock',receive,{token:staff})).code,400);
   receive.items[0].sellingPrice=medicine.sellingPrice;
   const accepted=await api.action('receiveStock',receive,{token:staff});assert.equal(accepted.code,200,accepted.body.error);
   db=await api.read();db.users.find(item=>item.id==='staff').branchAccessExpiresAt={a:'2000-01-01'};await api.shared.saveTenantDatabase('access',db);
   assert.equal((await api.action('receiveStock',receive,{token:staff})).code,400);
   assert.equal((await api.invoke('/api/state?scope=sales',undefined,{token:staff})).code,403);
  });
 }finally{await api.close();}
});
