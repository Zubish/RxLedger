import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import source from './fixtures/ux-database.mjs';
import {normalizePatientPhone} from '../src/patientRegistry.ts';
import {loadServerModule} from './helpers/load-server-module.mjs';
import {isolatedApi} from './helpers/isolated-api.mjs';
const {withPatientRegistry}=loadServerModule('server/patient-registry.ts');

test('canonical contact lookup recognises Nigerian local/international forms',()=>{
 for(const phone of ['08012345678','+2348012345678','234 801 234 5678','002348012345678','8012345678'])assert.equal(normalizePatientPhone(phone),'2348012345678');
 assert.equal(normalizePatientPhone('+44 7700 900123'),'447700900123');
});
test('legacy projection is stable, non-mutating and never merges branches or different named family members',()=>{
 const db=structuredClone(source);const untouched=structuredClone(db);
 db.sales[0].patientDetails={allergyStatus:'recorded',allergies:'Penicillin: rash',updatedAt:'2026-01-01'};
 const before=structuredClone(db);const projected=withPatientRegistry(db);
 assert.deepEqual(db,before);assert.deepEqual(projected.ledger,db.ledger);
 assert.equal(projected.sales[0].total,db.sales[0].total);
 assert.notEqual(projected.sales[0].patientId,projected.sales[1].patientId);
 assert.deepEqual(withPatientRegistry(projected),projected);
 assert.equal(projected.patients.find(patient=>patient.id===projected.sales[0].patientId).details.allergies,'Penicillin: rash');
 assert.deepEqual(untouched.sales.map(sale=>sale.branchId),projected.sales.map(sale=>sale.branchId));
});

test('Workspace Patient Registry — Cross-Branch Recognition',async t=>{
 const fixture=structuredClone(source);
 fixture.sales=[];fixture.posDrafts=[];fixture.continuityRequests=[];fixture.auditLogs=[];
 fixture.batches.forEach(batch=>batch.expiryDate='2099-01-01');
 fixture.ledger=fixture.batches.map(batch=>({id:`in-${batch.id}`,batchId:batch.id,medicineId:batch.medicineId,quantity:25,type:'stock-in',reason:'Synthetic receipt',reference:'SYNTHETIC',createdAt:new Date().toISOString(),userId:'admin'}));
 fixture.users.push({...fixture.users[1],id:'branch-b',branchIds:['b']},{...fixture.users[1],id:'cashier',role:'cashier'},{...fixture.users[1],id:'viewer',role:'viewer'},{...fixture.users[1],id:'inventory',role:'inventory'},{...fixture.users[1],id:'expired',branchAccessExpiresAt:{a:'2000-01-01'}});
 const api=await isolatedApi(fixture,'registry-fixture','staff');
 let patient;
 try {
  const b=(await api.shared.createSession('branch-b')).token;
  const owner=(await api.shared.createSession('admin')).token;
  const cashier=(await api.shared.createSession('cashier')).token;
  const sale=overrides=>({operationId:randomUUID(),branchId:'a',patientId:patient.id,customerName:patient.name,customerPhone:patient.phone,items:[{itemType:'medicine',itemId:'m1',quantity:1}],...overrides});
  await t.test('register one identity; international phone spelling cannot silently create a duplicate',async()=>{
   const result=await api.action('createPatient',{branchId:'a',patientName:'Ada Synthetic',patientPhone:'08012345678',patientDetails:{age:44,gender:'female',allergyStatus:'recorded',allergies:'Penicillin: rash'}});
   assert.equal(result.code,200);patient=result.body.patient;
   const duplicate=await api.action('createPatient',{branchId:'a',patientName:'Ada Synthetic',patientPhone:'+2348012345678'});
   assert.equal(duplicate.code,400);assert.equal((await api.read()).patients.length,1);
   assert.equal((await api.action('recordSale',sale())).code,200);
  });
  await t.test('another branch recognises patient/allergies without receiving foreign sales, receipts or totals',async()=>{
   const response=await api.invoke('/api/state',undefined,{token:b});assert.equal(response.code,200);
   assert.equal(response.body.db.patients[0].id,patient.id);assert.equal(response.body.db.patients[0].details.allergies,'Penicillin: rash');
   assert.equal(response.body.db.sales.length,0);assert.equal(response.body.db.receipts.length,0);
   const saleAtB=await api.action('recordSale',sale({branchId:'b'}),{token:b});assert.equal(saleAtB.code,200);
   assert.equal(saleAtB.body.checkout.sale.patientId,patient.id);
   const history=await api.action('getPatientCareHistory',{branchId:'b',patientId:patient.id},{token:b});assert.equal(history.code,200);
   assert.equal(history.body.patientCareHistory.length,2);
   for(const visit of history.body.patientCareHistory){assert.equal('total' in visit,false);assert.equal('paymentMethod' in visit,false);assert.equal('reference' in visit,false);for(const item of visit.items)assert.equal('unitPrice' in item,false);}
  });
  await t.test('shared family contact requires a reason and explicit person selection',async()=>{
   const blocked=await api.action('createPatient',{branchId:'b',patientName:'Child Synthetic',patientPhone:'+2348012345678'},{token:b});assert.equal(blocked.code,400);
   const registered=await api.action('createPatient',{branchId:'b',patientName:'Child Synthetic',patientPhone:'+2348012345678',sharedPhoneReason:"Parent's contact",patientDetails:{age:8,allergyStatus:'none'}},{token:b});assert.equal(registered.code,200);
   const child=registered.body.patient;
   const unselected=await api.action('recordSale',sale({patientId:'',customerName:child.name,customerPhone:child.phone}));assert.equal(unselected.code,400);
   const selected=await api.action('recordSale',sale({patientId:child.id,customerName:child.name,customerPhone:child.phone}));assert.equal(selected.code,200);
   assert.equal(selected.body.checkout.sale.patientDetails.allergyStatus,'none');
   assert.equal((await api.read()).patients.find(record=>record.id===patient.id).details.allergies,'Penicillin: rash');
  });
  await t.test('changing or clearing the person on a draft cannot carry over another patient risk/contact',async()=>{
   const draft=await api.action('savePosDraft',{...sale({}),patientRiskContext:{pregnant:true,allergies:'Parent only'}});assert.equal(draft.code,200);
   const draftId=(await api.read()).posDrafts[0].id;
   const child=(await api.read()).patients.find(record=>record.name==='Child Synthetic');
   const result=await api.action('recordSale',sale({draftId,patientId:child.id,customerName:child.name,customerPhone:child.phone}));assert.equal(result.code,200);
   assert.equal(result.body.checkout.sale.patientRiskContext.pregnant,false);
   const second=await api.action('savePosDraft',{...sale({}),patientRiskContext:{pregnant:true}});assert.equal(second.code,200);
   const anonymous=await api.action('recordSale',sale({draftId:(await api.read()).posDrafts[0].id,patientId:'',customerName:'',customerPhone:''}));assert.equal(anonymous.code,200);
   assert.equal(anonymous.body.checkout.sale.customerPhone,'');assert.equal(anonymous.body.checkout.sale.patientId,undefined);assert.equal(anonymous.body.checkout.sale.patientRiskContext.pregnant,false);
  });
  await t.test('profile updates are shared and audited; historical financial/clinical snapshots are preserved',async()=>{
   const before=(await api.read()).sales;
   const updated=await api.action('updateRegistryPatient',{branchId:'b',patientId:patient.id,expectedRevision:patient.revision,patientName:patient.name,patientPhone:patient.phone,patientDetails:{age:45,gender:'female',allergyStatus:'recorded',allergies:'Penicillin: rash; Aspirin: wheeze'}},{token:b});assert.equal(updated.code,200);
   const state=await api.read();assert.deepEqual(state.sales,before);
   const a=await api.invoke('/api/state');assert.equal(a.body.db.patients.find(record=>record.id===patient.id).details.age,45);
   const audit=state.auditLogs.find(row=>row.action==='Updated workspace patient');assert.equal(audit.before.details.age,44);assert.equal(audit.after.details.age,45);
  });
  await t.test('cashiers have identity/allergy lookup; care history, inactive assignments and other workspaces are protected',async()=>{
   const lookup=await api.invoke('/api/state',undefined,{token:cashier});assert.ok(lookup.body.db.patients.length>0);
   assert.equal((await api.action('getPatientCareHistory',{branchId:'a',patientId:patient.id},{token:cashier})).code,400);
   for(const id of ['viewer','inventory','expired']) {
    const token=(await api.shared.createSession(id)).token;
    const response=await api.invoke('/api/state',undefined,{token});assert.equal(response.body.db.patients.length,0);
    assert.equal((await api.action('createPatient',{branchId:'a',patientName:'Blocked',patientPhone:'08099999999'},{token})).code,400);
   }
   const other=structuredClone(fixture);other.users=[{...fixture.users[0],id:'foreign-owner'}];other.sales=[];other.patients=[];
   await api.shared.saveTenantDatabase('foreign-registry',other,true);
   assert.equal((await api.action('updateRegistryPatient',{branchId:'a',patientId:patient.id},{slug:'foreign-registry'})).code,401);
   const foreignToken=(await api.shared.createSession('foreign-owner')).token;
   assert.equal((await api.action('getPatientCareHistory',{branchId:'a',patientId:patient.id},{slug:'foreign-registry',token:foreignToken})).code,400);
  });
  await t.test('stale cross-branch edits cannot overwrite a newer allergy correction',async()=>{
   const before=(await api.read()).patients.find(record=>record.id===patient.id);
   const result=await api.action('updateRegistryPatient',{branchId:'a',patientId:patient.id,expectedRevision:patient.revision,patientName:patient.name,patientPhone:patient.phone,patientDetails:{allergyStatus:'none'}});
   assert.equal(result.code,400);
   assert.deepEqual((await api.read()).patients.find(record=>record.id===patient.id),before);
  });
  await t.test('simultaneous registration cannot create duplicate workspace identities',async()=>{
   const input={branchId:'a',patientName:'Concurrent Synthetic',patientPhone:'08055555555'};
   const results=await Promise.all([api.action('createPatient',input),api.action('createPatient',input)]);
   assert.equal(results.filter(result=>result.code===200).length,1);
   assert.equal((await api.read()).patients.filter(record=>record.normalizedPhone==='2348055555555').length,1);
  });
  await t.test('only an owner-confirmed, allergy-reviewed merge can combine identity links',async()=>{
   const duplicate=await api.action('createPatient',{branchId:'a',patientName:'Ada Alias Synthetic',patientPhone:'08098765432',patientDetails:{allergyStatus:'recorded',allergies:'Sulfonamide: rash'}});
   const sourceId=duplicate.body.patient.id;
   assert.equal((await api.action('recordSale',sale({patientId:sourceId,customerName:duplicate.body.patient.name,customerPhone:duplicate.body.patient.phone}))).code,200);
   const current=(await api.read()).patients.find(record=>record.id===patient.id);
   const data={sourcePatientId:sourceId,targetPatientId:patient.id,sourceRevision:duplicate.body.patient.revision,targetRevision:current.revision,reason:'Synthetic identity confirmation',identityConfirmed:true,patientDetails:{age:45,gender:'female',allergyStatus:'recorded',allergies:'Penicillin: rash; Aspirin: wheeze; Sulfonamide: rash'}};
   assert.equal((await api.action('mergeRegistryPatients',data)).code,400);
   assert.equal((await api.action('mergeRegistryPatients',{...data,identityConfirmed:false},{token:owner})).code,400);
   const before=(await api.read()).sales.map(({patientId,...sale})=>sale);
   const result=await api.action('mergeRegistryPatients',data,{token:owner});assert.equal(result.code,200);
   const after=await api.read();assert.deepEqual(after.sales.map(({patientId,...sale})=>sale),before);
   assert.equal(after.patients.find(record=>record.id===sourceId).mergedIntoId,patient.id);
   assert.equal(after.sales.filter(record=>record.patientId===sourceId).length,0);
   assert.ok(after.auditLogs.some(row=>row.action==='Merged confirmed patient identities'));
   assert.ok(after.patients.find(record=>record.id===patient.id).contactAliases.includes('08098765432'));
   assert.equal((await api.action('createPatient',{branchId:'a',patientName:'Ada Alias Synthetic',patientPhone:'08098765432'})).code,400);
  });
 } finally {await api.close();}
});

test('legacy registry initialization is read-only until a normal write, then audited once',async()=>{
 const fixture=structuredClone(source);
 fixture.ledger=fixture.batches.map(batch=>({id:`in-${batch.id}`,batchId:batch.id,medicineId:batch.medicineId,quantity:25,type:'stock-in',reason:'Synthetic receipt',reference:'SYNTHETIC',createdAt:new Date().toISOString(),userId:'staff'}));
 const api=await isolatedApi(fixture,'legacy-registry','staff');
 try {
  delete fixture.patients;
  await api.postgres.query('UPDATE tenant_state SET data=$1::jsonb,updated_at=clock_timestamp() WHERE slug=$2',[JSON.stringify(fixture),api.slug]);
  const before=(await api.postgres.query('SELECT data FROM tenant_state WHERE slug=$1',[api.slug])).rows[0].data;
  const read=await api.invoke('/api/state');assert.equal(read.code,200);assert.ok(read.body.db.patients.length>0);
  assert.deepEqual((await api.postgres.query('SELECT data FROM tenant_state WHERE slug=$1',[api.slug])).rows[0].data,before);
  assert.equal((await api.action('markChatRead',{branchId:'a'})).code,200);
  let state=await api.read();assert.ok(state.sales.every(sale=>sale.patientId));
  assert.deepEqual(state.sales.map(sale=>[sale.id,sale.branchId,sale.total,sale.subtotal]),fixture.sales.map(sale=>[sale.id,sale.branchId,sale.total,sale.subtotal]));
  assert.equal(state.auditLogs.filter(row=>row.action==='Initialized workspace patient registry').length,1);
  assert.equal((await api.action('markChatRead',{branchId:'a'})).code,200);
  state=await api.read();assert.equal(state.auditLogs.filter(row=>row.action==='Initialized workspace patient registry').length,1);
 } finally {await api.close();}
});
