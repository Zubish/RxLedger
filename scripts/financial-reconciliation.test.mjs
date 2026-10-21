import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import source from './fixtures/ux-database.mjs';
import {isolatedApi} from './helpers/isolated-api.mjs';

const range='/api/state?scope=financial&start=2020-01-01&end=2020-12-31';
test('Financial reconciliation: actual handler and persisted PostgreSQL',async t=>{
 const fixture=structuredClone(source);fixture.sales=[];fixture.posDrafts=[];fixture.continuityRequests=[];fixture.auditLogs=[];
 fixture.batches.forEach(batch=>batch.expiryDate='2099-01-01');
 fixture.ledger=fixture.batches.map(batch=>({id:`in-${batch.id}`,batchId:batch.id,medicineId:batch.medicineId,quantity:100,type:'stock-in',reason:'Synthetic receipt',reference:'SYNTHETIC',createdAt:new Date().toISOString(),userId:'staff'}));
 fixture.products=[];
 const api=await isolatedApi(fixture,'finance','staff');
 const day=new Date().toISOString().slice(0,10);
 const report=options=>api.invoke(`/api/state?scope=financial&start=${day}&end=${day}`,undefined,options);
 const sale=(extra={})=>api.action('recordSale',{operationId:randomUUID(),branchId:'a',items:[{itemType:'medicine',itemId:'m1',quantity:3}],discount:0,paymentMethod:'cash',...extra});
 try{
  await t.test('cash, discount and historical cost reconcile without using current catalogue price',async()=>{
   const result=await sale({discount:15,cashTendered:500});assert.equal(result.code,200);
   const sold=result.body.checkout.sale;assert.equal(sold.subtotal,450);assert.equal(sold.total,435);assert.equal(sold.cashTendered,500);assert.equal(sold.changeGiven,65);assert.equal(sold.items[0].unitCost,100);assert.equal(sold.taxStatus,'unconfigured');
   let db=await api.read();db.batches.find(batch=>batch.id==='m1a').unitCost=999;db.medicines.find(m=>m.id==='m1').costPrice=999;await api.shared.saveTenantDatabase('finance',db);
   const response=await report();assert.equal(response.code,200);const row=response.body.rows[0];assert.equal(row.cost,300);assert.equal(row.grossMargin,135);assert.deepEqual(row.issues,[]);assert.deepEqual(response.body.totals.paymentTotals,{cash:435});
  });
  await t.test('card and transfer reconcile, replay counts once, invalid tender/payment rejected atomically',async()=>{
   const card={paymentMethod:'card',operationId:randomUUID()};assert.equal((await sale(card)).code,200);const replay=await sale(card);assert.equal(replay.code,200);assert.equal(replay.body.checkout.replayed,true);assert.equal((await sale({paymentMethod:'transfer'})).code,200);
   const before=await api.read();
   for(const extra of [{cashTendered:1},{paymentMethod:'mixed'},{paymentMethod:'invented'},{discount:'not-money'},{discount:-1},{quotedTotal:1}])assert.equal((await sale(extra)).code,400);
   assert.equal((await api.read()).sales.length,before.sales.length);
   const confirmed=before.sales[0];assert.ok(confirmed.checkoutOperationId);
   const response=await report();assert.equal(response.body.totals.sales,3);assert.equal(response.body.totals.net,1335);assert.deepEqual(response.body.totals.paymentTotals,{cash:435,card:450,transfer:450});
  });
  await t.test('physical customer returns do not silently refund financial sales',async()=>{
   const before=(await report()).body.totals;
   const returned=await api.action('adjustStock',{branchId:'a',batchId:'m1a',mode:'customer-return',quantity:1,reason:'Physical goods only',reference:'RETURN-SYNTHETIC'});
   assert.equal(returned.code,200);assert.deepEqual((await report()).body.totals,before);
  });
  await t.test('currency is rounded consistently at line and payment boundaries',async()=>{
   const db=await api.read();db.medicines.find(m=>m.id==='m2').sellingPrice=0.1;await api.shared.saveTenantDatabase('finance',db);
   const result=await api.action('recordSale',{operationId:randomUUID(),branchId:'a',items:[{itemType:'medicine',itemId:'m2',quantity:3}],discount:0.01,paymentMethod:'cash',cashTendered:1});
   assert.equal(result.code,200);assert.equal(result.body.checkout.sale.subtotal,0.3);assert.equal(result.body.checkout.sale.total,0.29);assert.equal(result.body.checkout.sale.changeGiven,0.71);
   assert.deepEqual((await report()).body.rows.find(row=>row.id===result.body.checkout.sale.id).issues,[]);
  });
  await t.test('legacy costs are unknown, mismatches flagged; complete report ignores UI history page limits',async()=>{
   const db=await api.read();const template=structuredClone(db.sales[0]);
   const zero=api.shared.normalizeDatabase({...db,sales:[{...template,total:0,subtotal:0}]});assert.equal(zero.sales[0].total,0);assert.equal(zero.sales[0].subtotal,0);
   for(let i=0;i<270;i++)db.sales.push({...template,id:`legacy-${i}`,reference:`LEGACY-${i}`,checkoutOperationId:undefined,branchId:i===269?'b':'a',customerName:'SHOULD NOT LEAK',items:template.items.map(item=>({...item,unitCost:undefined}))});
   await api.shared.saveTenantDatabase('finance',db);
   const response=await report();assert.equal(response.body.totals.sales,273);assert.equal(response.body.totals.missingCostSales,269);assert.equal(response.body.totals.cost,null);assert.equal(response.body.totals.grossMargin,null);assert.equal(response.body.totals.issueSales,269);
   assert.ok(!JSON.stringify(response.body).includes('SHOULD NOT LEAK'));assert.ok(!response.body.rows.some(row=>row.branchId==='b'));
   assert.equal((await api.invoke(`/api/state?scope=financial&branchId=b&start=${day}&end=${day}`)).code,403);
   assert.equal((await api.invoke('/api/state?scope=financial&start=2026-02-30&end=2026-03-02')).code,400);
   assert.equal((await api.invoke('/api/state?scope=financial&start=2020-01-01&end=2026-01-01')).code,400);
   assert.equal((await api.invoke(range)).body.rows.length,0);
   assert.equal((await report({token:'invalid'})).code,401);
   assert.equal((await report({slug:'foreign-workspace'})).code,404);
  });
 }finally{await api.close();}
});
