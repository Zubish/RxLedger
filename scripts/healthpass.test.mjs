import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { verifyServiceBody, signServiceBody } from '../server/healthpass/auth.ts';
import { scopeDatabaseForUser } from '../server/branch-scope.ts';
const code = stripTypeScriptTypes(readFileSync(new URL('../server/healthpass/workflow.ts',import.meta.url),'utf8')).replace('../branch-scope.js',new URL('../server/branch-scope.ts',import.meta.url).href);
const flow = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const now = Date.now();
const future = new Date(now+3600000).toISOString();
const scope = {sourceOrganizationId:'facility',tenantId:'pharmacy',branchId:'a'};
const pharmacist = {id:'pharmacist',role:'pharmacist',status:'active',branchIds:['a'],managedBranchIds:[]};
const cashier = {...pharmacist,id:'cashier',role:'cashier'};
function setup() {
 const db = {settings:{primaryAdminId:'admin'},users:[pharmacist,cashier],branches:[{id:'a',active:true},{id:'b',active:true}],medicines:[{id:'med',active:true,brandName:'Example',strength:'5 mg',form:'tablet',sellableUnit:'tablet'}],auditLogs:[],sales:[],products:[],batches:[],ledger:[],stockSnapshot:[],ledgerSummary:{todayMovementCountsByBatchId:{},todayMovementCountsByBranchId:{}},receipts:[],continuityRequests:[],requisitions:[],branchAccessRequests:[],chatMessages:[],passwordResetRequests:[],securityEvents:[],posDrafts:[]};
 const p = {prescriptionId:'rx',version:1,patientLinkId:'reviewed-link',patient:{healthPassId:'patient',name:'Synthetic Patient',contactPhone:'0000000000'},encounterId:'encounter',prescriber:{id:'doctor',facilityId:'facility',verificationReference:'verified-ref'},signedAt:new Date(now-1000).toISOString(),validUntil:future,pharmacy:{tenantId:'pharmacy',branchId:'a'},consent:{grantId:'consent',version:1,expiresAt:future,purpose:'prescription_fulfilment'},items:[{id:'item',name:'Example',form:'tablet',strength:'5 mg',dose:'1',doseUnit:'tablet',route:'oral',frequency:'daily',duration:'10 days',quantity:10,dispensingUnit:'tablet',instructions:'Synthetic fixture only',substitutionPolicy:'prescriber_approval_required'}]};
 const event = {eventId:'event',eventType:'prescription.dispatched',schemaVersion:1,occurredAt:new Date(now).toISOString(),producer:'healthpass',sourceOrganizationId:'facility',correlationId:'correlation',aggregateId:'rx',aggregateVersion:1,payload:p};
 return {db,event,p};
}
function accept(db) {flow.reviewPrescription(db,pharmacist,{prescriptionId:'rx',version:1,status:'accepted',mappings:[{prescriptionItemId:'item',medicineId:'med'}]});}
function prepare(db,quantity,operationId='op') {
 return flow.prepareDispense(db,cashier,'a',{prescriptionId:'rx',version:1,operationId,items:[{prescriptionItemId:'item',medicineId:'med',quantity}]},[{itemType:'medicine',itemId:'med',quantity}]);
}
function finish(db,prepared,quantity,id='sale') {flow.completeDispense(db,prepared,{id,branchId:'a',soldAt:new Date(now).toISOString(),items:[{itemType:'medicine',medicineId:'med',quantity,labelInstruction:'Synthetic instruction'}]});}
test('raw-body authentication rejects forged, changed and expired requests',()=>{
 const body='{"action":"pullEvents"}',secret='s'.repeat(32),timestamp=String(Math.floor(now/1000));
 const headers={'x-ecosystem-timestamp':timestamp,'x-ecosystem-key-id':'key','x-ecosystem-signature':signServiceBody(body,timestamp,secret)};
 assert.doesNotThrow(()=>verifyServiceBody(body,headers,{secret,keyId:'key'},now));
 assert.throws(()=>verifyServiceBody(body+' ',headers,{secret,keyId:'key'},now));
 assert.throws(()=>verifyServiceBody(body,headers,{secret,keyId:'key'},now+301000));
 assert.throws(()=>verifyServiceBody(body,{...headers,'x-ecosystem-key-id':'other'},{secret,keyId:'key'},now));
});
test('receipt is durable and idempotent without stock movement; changed replay rejected',()=>{
 const {db,event}=setup();flow.receivePrescription(db,event,scope,now);
 assert.equal(flow.receivePrescription(db,event,scope,now).duplicate,true);
 assert.equal(db.healthpass.prescriptions.length,1);assert.equal(db.healthpass.outbox.length,1);assert.equal(db.ledger.length,0);
 assert.throws(()=>flow.receivePrescription(db,{...event,payload:{...event.payload,patientLinkId:'changed'}},scope,now),/reused/);
});
test('dispatch rejects foreign scope, duplicate items, invalid quantities and expired grants',()=>{
 for(const change of [p=>p.pharmacy.branchId='b',p=>p.patientLinkId='',p=>p.items.push({...p.items[0]}),p=>p.items[0].quantity=NaN,p=>p.consent.expiresAt=new Date(now-1).toISOString(),p=>p.prescriber.facilityId='other']) {
  const {db,event}=setup();change(event.payload);assert.throws(()=>flow.receivePrescription(db,event,scope,now));
 }
});
test('only assigned active pharmacist can review; ambiguous units and strengths are rejected',()=>{
 const {db,event}=setup();flow.receivePrescription(db,event,scope,now);
 for(const actor of [cashier,{...pharmacist,branchIds:['b']},{...pharmacist,status:'suspended'}]) assert.throws(()=>flow.reviewPrescription(db,actor,{prescriptionId:'rx',version:1,status:'accepted',mappings:[{prescriptionItemId:'item',medicineId:'med'}]}));
 db.medicines[0].sellableUnit='pack';assert.throws(()=>accept(db),/unit/);db.medicines[0].sellableUnit='tablet';db.medicines[0].strength='10 mg';assert.throws(()=>accept(db),/mismatch/);
 db.medicines[0].strength='5 mg';db.medicines[0].brandName='Unrelated drug';assert.throws(()=>accept(db),/Drug identity mismatch/);
});
test('partial sale emits actual quantity; retries do not resupply and remaining supply is bounded',()=>{
 const {db,event}=setup();flow.receivePrescription(db,event,scope,now);accept(db);
 finish(db,prepare(db,4),4);
 assert.equal(db.healthpass.prescriptions[0].fulfilment,'partial');assert.equal(db.healthpass.prescriptions[0].supplied.item,4);
 assert.equal(prepare(db,4).duplicate,true);
 assert.throws(()=>prepare(db,5),/reused/);
 assert.throws(()=>prepare(db,7,'next'),/remaining/);
 finish(db,prepare(db,6,'next'),6,'sale2');
 assert.equal(db.healthpass.prescriptions[0].fulfilment,'complete');
 const events=db.healthpass.outbox.filter(r=>r.event.eventType==='dispense.recorded');assert.equal(events.length,2);assert.equal(events[0].event.payload.items[0].quantity,4);
 assert.throws(()=>prepare(db,1,'third'),/remaining/);
});
test('unreviewed prescriptions, other branches and unmapped cart items cannot dispense',()=>{
 const {db,event}=setup();flow.receivePrescription(db,event,scope,now);assert.throws(()=>prepare(db,1),/Pharmacist/);accept(db);
 assert.throws(()=>flow.prepareDispense(db,cashier,'b',{prescriptionId:'rx',version:1,operationId:'op',items:[]},[]),/another branch/);
 assert.throws(()=>flow.prepareDispense(db,cashier,'a',{prescriptionId:'rx',version:1,operationId:'op',items:[{prescriptionItemId:'item',medicineId:'med',quantity:1}]},[{itemType:'product',itemId:'med',quantity:1}]),/mapping/);
});
test('revocation cancels remaining supply, retains actual supply and removes shared identity context',()=>{
 const {db,event}=setup();flow.receivePrescription(db,event,scope,now);accept(db);finish(db,prepare(db,2),2);
 const control={...event,eventId:'revocation',eventType:'consent.revoked',payload:{prescriptionId:'rx',version:1,patientLinkId:'reviewed-link'}};
 flow.receivePrescriptionControl(db,control,scope);assert.equal(flow.receivePrescriptionControl(db,control,scope).duplicate,true);
 assert.equal(db.healthpass.prescriptions[0].supplied.item,2);assert.equal(db.healthpass.prescriptions[0].prescription.patient.name,'');assert.throws(()=>prepare(db,1,'next'),/inactive/);
});
test('browser state excludes integration credentials, delivery payloads and foreign prescription branches',()=>{
 const {db,event}=setup();flow.receivePrescription(db,event,scope,now);
 assert.equal(scopeDatabaseForUser(db,pharmacist).healthpass.prescriptions.length,1);
 assert.equal(scopeDatabaseForUser(db,{...pharmacist,branchIds:['b']}).healthpass.prescriptions.length,0);
 assert.equal(scopeDatabaseForUser(db,{...pharmacist,role:'inventory'}).healthpass.prescriptions.length,0);
 const browser=scopeDatabaseForUser(db,pharmacist).healthpass;assert.equal(browser.outbox.length+browser.inbox.length+browser.operations.length,0);
});

const {actualActions,liveAuthorization}=await import('./healthpass-test-loader.mjs');
test('real RxLedger sale preserves stock rules and writes feedback once with the ledger',()=>{
 const {db,event}=setup();
 db.medicines[0]={...db.medicines[0],sellingPrice:2};
 db.batches=[{id:'batch',medicineId:'med',branchId:'a',expiryDate:'2099-01-01',sellingPrice:2}];
 db.ledger=[{id:'stock',batchId:'batch',medicineId:'med',type:'stock-in',quantity:10,createdAt:new Date(now).toISOString()}];
 flow.receivePrescription(db,event,scope,now);accept(db);
 const payload={branchId:'a',items:[{itemType:'medicine',itemId:'med',quantity:4}],healthpass:{prescriptionId:'rx',version:1,operationId:'actual-op',items:[{prescriptionItemId:'item',medicineId:'med',quantity:4}]}};
 actualActions.recordSale(db,cashier.id,cashier.role,payload);
 assert.equal(db.sales.length,1);assert.equal(db.ledger.reduce((sum,row)=>sum+row.quantity,0),6);
 assert.equal(db.healthpass.outbox.filter(row=>row.event.eventType==='dispense.recorded').length,1);
 assert.equal(db.healthpass.outbox.at(-1).event.payload.sourceTransactionId,db.sales[0].id);
 actualActions.recordSale(db,cashier.id,cashier.role,payload);
 assert.equal(db.sales.length,1);assert.equal(db.ledger.reduce((sum,row)=>sum+row.quantity,0),6);
 const over={...payload,items:[{itemType:'medicine',itemId:'med',quantity:7}],healthpass:{...payload.healthpass,operationId:'over',items:[{prescriptionItemId:'item',medicineId:'med',quantity:7}]}};
 assert.throws(()=>actualActions.recordSale(db,cashier.id,cashier.role,over),/remaining/);
 assert.equal(db.sales.length,1);
});
test('expired RxLedger batches block linked sales even when prescription is approved',()=>{
 const {db,event}=setup();db.medicines[0].sellingPrice=2;db.batches=[{id:'batch',medicineId:'med',branchId:'a',expiryDate:'2000-01-01',sellingPrice:2}];db.ledger=[{batchId:'batch',quantity:10}];
 flow.receivePrescription(db,event,scope,now);accept(db);
 assert.throws(()=>actualActions.recordSale(db,cashier.id,cashier.role,{branchId:'a',items:[{itemType:'medicine',itemId:'med',quantity:1}],healthpass:{prescriptionId:'rx',version:1,operationId:'expired-batch',items:[{prescriptionItemId:'item',medicineId:'med',quantity:1}]}}),/non-expired stock/);
 assert.equal(db.sales.length,0);assert.equal(db.healthpass.prescriptions[0].supplied.item,undefined);
 assert.equal(db.healthpass.outbox.filter(row=>row.event.eventType==='dispense.recorded').length,0);
});
test('production live authorization fails closed and authenticates each supply check',async()=>{
 const {db,event}=setup();flow.receivePrescription(db,event,scope,now);accept(db);
 const keys=['NODE_ENV','HEALTHPASS_AUTHORIZATION_URL','HEALTHPASS_SERVICE_SECRET','HEALTHPASS_SERVICE_KEY_ID'];
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]])),previousFetch=globalThis.fetch;
 try {
  process.env.NODE_ENV='production';delete process.env.HEALTHPASS_AUTHORIZATION_URL;
  const link={prescriptionId:'rx',version:1};
  await assert.rejects(liveAuthorization.assertLiveAuthorization(db,link),/required/);
  process.env.HEALTHPASS_AUTHORIZATION_URL='https://healthpass.synthetic.invalid/api/v1/integrations/rxledger/authorization';process.env.HEALTHPASS_SERVICE_SECRET='s'.repeat(32);process.env.HEALTHPASS_SERVICE_KEY_ID='key';
  globalThis.fetch=async(url,options)=>{verifyServiceBody(options.body,options.headers,{secret:'s'.repeat(32),keyId:'key'});assert.deepEqual(JSON.parse(options.body),{prescriptionId:'rx',version:1,patientLinkId:'reviewed-link'});return new Response(JSON.stringify({authorized:false}),{status:200});};
  await assert.rejects(liveAuthorization.assertLiveAuthorization(db,link),/denied/);
  globalThis.fetch=async()=>new Response(JSON.stringify({authorized:true}),{status:200});await liveAuthorization.assertLiveAuthorization(db,link);
  assert.equal(db.sales.length,0);assert.equal(db.healthpass.prescriptions[0].supplied.item,undefined);
 } finally {for(const key of keys) {if(previous[key]===undefined) delete process.env[key];else process.env[key]=previous[key];}globalThis.fetch=previousFetch;}
});
test('new supply rechecks mutable catalog identity after pharmacist acceptance',()=>{
 for(const update of [{brandName:'Other drug',genericName:'Other drug'},{strength:'50 mg'},{form:'capsule'},{sellableUnit:'pack'},{active:false}]) {
  const {db,event}=setup();flow.receivePrescription(db,event,scope,now);accept(db);Object.assign(db.medicines[0],update);
  assert.throws(()=>prepare(db,1),/mismatch|unit|inactive/);assert.equal(db.healthpass.prescriptions[0].supplied.item,undefined);
 }
});
test('exact signed receipt retries acknowledge after expiry while changed or foreign replay is rejected',()=>{
 const {db,event}=setup();flow.receivePrescription(db,event,scope,now);
 assert.equal(flow.receivePrescription(db,event,scope,now+7200000).duplicate,true);
 assert.throws(()=>flow.receivePrescription(db,{...event,payload:{...event.payload,validUntil:new Date(now+8000000).toISOString()}},scope,now+7200000),/reused/);
 assert.throws(()=>flow.receivePrescription(db,event,{...scope,branchId:'b'},now+7200000),/scope/);
 assert.equal(db.healthpass.outbox.length,1);
});
test('committed sale retry survives revoke/expiry without live check; new or altered operations remain denied',async()=>{
 const {db,event}=setup();db.medicines[0].sellingPrice=2;db.batches=[{id:'batch',medicineId:'med',branchId:'a',expiryDate:'2099-01-01',sellingPrice:2}];db.ledger=[{batchId:'batch',quantity:10}];
 flow.receivePrescription(db,event,scope,now);accept(db);
 const payload={branchId:'a',items:[{itemType:'medicine',itemId:'med',quantity:2}],healthpass:{prescriptionId:'rx',version:1,operationId:'replay-sale',items:[{prescriptionItemId:'item',medicineId:'med',quantity:2}]}};
 actualActions.recordSale(db,cashier.id,cashier.role,payload);
 const record=db.healthpass.prescriptions[0];record.inactive='consent_revoked';record.prescription.validUntil=new Date(now-1).toISOString();
 const oldEnv=process.env.NODE_ENV,oldFetch=globalThis.fetch;let fetches=0;
 process.env.NODE_ENV='production';globalThis.fetch=async()=>{fetches++;throw Error('Revoked');};
 try {
  await actualActions.authorizeHealthPassAction(db,cashier,payload);actualActions.recordSale(db,cashier.id,cashier.role,payload);
  assert.equal(fetches,0);assert.equal(db.sales.length,1);assert.equal(db.healthpass.outbox.filter(row=>row.event.eventType==='dispense.recorded').length,1);
  await assert.rejects(actualActions.authorizeHealthPassAction(db,cashier,{...payload,healthpass:{...payload.healthpass,operationId:'new'}}),/inactive/);
  await assert.rejects(actualActions.authorizeHealthPassAction(db,cashier,{...payload,items:[{itemType:'medicine',itemId:'med',quantity:3}]}),/reused/);
  await assert.rejects(actualActions.authorizeHealthPassAction(db,{...cashier,branchIds:['b']},payload),/access denied/);
 } finally {if(oldEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv;globalThis.fetch=oldFetch;}
});
test('production browser reads hide revoked/unavailable HealthPass context without changing pharmacy history',async()=>{
 const {db,event}=setup();flow.receivePrescription(db,event,scope,now);db.sales=[{id:'pharmacy-owned-sale',customerName:'Recorded Patient'}];
 const before=structuredClone(db),old=process.env.NODE_ENV;process.env.NODE_ENV='production';
 try {
  for(const denial of [async()=>{throw Error('revoked');},async()=>{throw Error('unavailable');}]) {
   const response=await liveAuthorization.filterAuthorizedHealthPassContext(db,denial);assert.equal(response.healthpass.prescriptions.length,0);assert.deepEqual(response.sales,db.sales);assert.deepEqual(db,before);
  }
  const allowed=await liveAuthorization.filterAuthorizedHealthPassContext(db,async()=>{});assert.equal(allowed.healthpass.prescriptions.length,1);allowed.healthpass.prescriptions[0].prescription.patient.name='Changed response only';assert.deepEqual(db,before);
 } finally {if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;}
});
