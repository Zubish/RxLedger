import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import source from './fixtures/ux-database.mjs';
import {isolatedApi} from './helpers/isolated-api.mjs';

function fixture() {
 const db=structuredClone(source);
 db.sales=[];db.posDrafts=[];db.auditLogs=[];db.continuityRequests=[];
 db.batches.forEach(batch=>batch.expiryDate='2099-01-01');
 db.ledger=db.batches.map(batch=>({id:`in-${batch.id}`,batchId:batch.id,medicineId:batch.medicineId,quantity:25,type:'stock-in',reason:'Synthetic receipt',reference:'SYNTHETIC',createdAt:new Date().toISOString(),userId:'staff'}));
 db.users.push({...db.users[1],id:'other-staff'});
 return db;
}
const payload=()=>({operationId:randomUUID(),branchId:'a',items:[{itemType:'medicine',itemId:'m1',quantity:3}],paymentMethod:'cash',discount:0});
function counts(db) {return {sales:db.sales.length,audits:db.auditLogs.filter(row=>row.action==='Completed POS sale').length,stock:db.ledger.filter(row=>row.batchId==='m1a').reduce((sum,row)=>sum+row.quantity,0)};}

test('Checkout Reliability — Duplicate Sale Protection',async t=>{
 const api=await isolatedApi(fixture(),'checkout-fixture','staff');
 try {
  await t.test('a lost success response can be retried with the same receipt and one deduction',async()=>{
   const checkout=payload();
   const initial=await api.action('recordSale',checkout);assert.equal(initial.code,200);
   const before=counts(await api.read());
   const retry=await api.action('recordSale',checkout);
   assert.equal(retry.code,200);assert.equal(retry.body.checkout.replayed,true);
   assert.equal(retry.body.checkout.sale.id,initial.body.checkout.sale.id);
   assert.equal(retry.body.checkout.sale.reference,initial.body.checkout.sale.reference);
   assert.deepEqual(counts(await api.read()),before);
   assert.ok(retry.body.databasePatch.sales.upserts.some(row=>row.id===initial.body.checkout.sale.id));
   assert.equal(retry.body.databasePatch.ledger.upserts.filter(row=>row.reference===initial.body.checkout.sale.reference).length,1);
   const conflict=await api.action('recordSale',{...checkout,items:[{itemType:'medicine',itemId:'m1',quantity:4}]});
   assert.equal(conflict.code,400);assert.equal(conflict.body.checkoutState,'unknown');assert.match(conflict.body.error,/different cart/);
   assert.deepEqual(counts(await api.read()),before);
  });
  await t.test('simultaneous requests hit the version conflict path and return the same original sale',async()=>{
   const checkout=payload();const before=counts(await api.read());
   let arrivals=0,release;
   const barrier=new Promise(resolve=>release=resolve);
   const timer=setTimeout(release,5000);
   api.beforeSql(async({query,values})=>{
    if(query.includes('UPDATE tenant_state') && JSON.parse(values[0]).sales.some(row=>row.checkoutOperationId===checkout.operationId)) {
     if(++arrivals===2)release();await barrier;
    }
   });
   let replies;
   try {replies=await Promise.all([api.action('recordSale',checkout),api.action('recordSale',checkout)]);}
   finally {clearTimeout(timer);release();api.beforeSql(undefined);}
   assert.equal(arrivals,2);assert.deepEqual(replies.map(row=>row.code),[200,200]);
   assert.equal(replies[0].body.checkout.sale.reference,replies[1].body.checkout.sale.reference);
   assert.deepEqual(counts(await api.read()),{sales:before.sales+1,audits:before.audits+1,stock:before.stock-3});
  });
  await t.test('status is read-only and a completed checkout cannot be cancelled into another sale',async()=>{
   const checkout=payload();const completed=await api.action('recordSale',checkout);
   const before=(await api.postgres.query('SELECT data,updated_at::text AS version FROM tenant_state WHERE slug=$1',[api.slug])).rows[0];
   const status=await api.action('getCheckoutStatus',{branchId:'a',operationId:checkout.operationId});
   const cancel=await api.action('cancelCheckout',{branchId:'a',operationId:checkout.operationId});
   assert.equal(status.body.checkout.sale.reference,completed.body.checkout.sale.reference);
   assert.equal(cancel.body.checkout.state,'confirmed');
   assert.deepEqual((await api.postgres.query('SELECT data,updated_at::text AS version FROM tenant_state WHERE slug=$1',[api.slug])).rows[0],before);
  });
  await t.test('cancellation wins safely against an in-flight request; late submission cannot commit',async()=>{
   const checkout=payload();const before=counts(await api.read());let held,release;
   const entered=new Promise(resolve=>held=resolve);const barrier=new Promise(resolve=>release=resolve);
   const timer=setTimeout(()=>{held();release();},5000);
   api.beforeSql(async({query,values})=>{
    if(query.includes('UPDATE tenant_state') && JSON.parse(values[0]).sales.some(row=>row.checkoutOperationId===checkout.operationId)){held();await barrier;}
   });
   let original,cancel;
   try {
    original=api.action('recordSale',checkout);await entered;
    cancel=await api.action('cancelCheckout',{branchId:'a',operationId:checkout.operationId});release();
    assert.equal((await original).code,400);
   } finally {clearTimeout(timer);release();api.beforeSql(undefined);}
   assert.equal(cancel.body.checkout.state,'cancelled');assert.deepEqual(counts(await api.read()),before);
   assert.equal((await api.action('recordSale',checkout)).code,400);
   assert.equal((await api.action('getCheckoutStatus',{branchId:'a',operationId:checkout.operationId})).body.checkout.state,'cancelled');
  });
  await t.test('a completed sale wins against a delayed cancellation and returns its receipt',async()=>{
   const checkout=payload();const before=counts(await api.read());let held,release;
   const entered=new Promise(resolve=>held=resolve);const barrier=new Promise(resolve=>release=resolve);
   const timer=setTimeout(()=>{held();release();},5000);
   api.beforeSql(async({query,values})=>{
    if(query.includes('UPDATE tenant_state') && JSON.parse(values[0]).cancelledCheckouts?.some(row=>row.operationId===checkout.operationId)){held();await barrier;}
   });
   let cancellation,completed;
   try {
    cancellation=api.action('cancelCheckout',{branchId:'a',operationId:checkout.operationId});await entered;
    completed=await api.action('recordSale',checkout);release();
    const result=await cancellation;assert.equal(result.code,200);assert.equal(result.body.checkout.state,'confirmed');
    assert.equal(result.body.checkout.sale.reference,completed.body.checkout.sale.reference);
   } finally {clearTimeout(timer);release();api.beforeSql(undefined);}
   assert.deepEqual(counts(await api.read()),{sales:before.sales+1,audits:before.audits+1,stock:before.stock-3});
   assert.equal((await api.read()).cancelledCheckouts.some(row=>row.operationId===checkout.operationId),false);
  });
  await t.test('retrying the original consumed draft returns its sale rather than creating another',async()=>{
   const before=counts(await api.read());
   assert.equal((await api.action('savePosDraft',{branchId:'a',items:[{itemType:'medicine',itemId:'m1',quantity:1}]})).code,200);
   const draftId=(await api.read()).posDrafts[0].id;
   const checkout={...payload(),draftId,items:[{itemType:'medicine',itemId:'m1',quantity:1}]};
   const first=await api.action('recordSale',checkout);assert.equal(first.code,200);
   assert.equal((await api.read()).posDrafts.length,0);
   const retry=await api.action('recordSale',checkout);assert.equal(retry.code,200);
   assert.equal(retry.body.checkout.sale.reference,first.body.checkout.sale.reference);
   assert.deepEqual(counts(await api.read()),{sales:before.sales+1,audits:before.audits+1,stock:before.stock-1});
  });
  await t.test('operation lookup/replay respects actor, branch, session and workspace',async()=>{
   const checkout=payload();assert.equal((await api.action('recordSale',checkout)).code,200);
   const other=await api.shared.createSession('other-staff');
   for(const action of ['recordSale','getCheckoutStatus','cancelCheckout']) {
    assert.equal((await api.action(action,checkout,{token:other.token})).code,400);
    assert.equal((await api.action(action,{...checkout,branchId:'b'})).code,400);
    assert.equal((await api.action(action,checkout,{token:'invalid-session'})).code,401);
   }
   const foreign=fixture();foreign.users=foreign.users.filter(row=>row.id!=='staff');
   await api.shared.saveTenantDatabase('foreign-fixture',foreign,true);
   assert.equal((await api.action('recordSale',checkout,{slug:'foreign-fixture'})).code,401);
   const publicState=await api.invoke('/api/state');
   assert.ok(publicState.body.db.cancelledCheckouts.every(row=>row.userId==='staff' && row.branchId==='a'));
  });
  await t.test('missing or malformed operation ID is rejected before saving; old sales remain readable',async()=>{
   const before=counts(await api.read());
   for(const operationId of [undefined,'bad-key','123']) {
    const response=await api.action('recordSale',{...payload(),operationId});
    assert.equal(response.code,400);assert.equal(response.body.checkoutState,'rejected');
   }
   assert.deepEqual(counts(await api.read()),before);
  });
 } finally {await api.close();}
});
