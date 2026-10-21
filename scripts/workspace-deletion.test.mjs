import {loadServerModule} from "./helpers/load-server-module.mjs";
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { resolve } from 'node:path';
import { tenantWorkspaceSlug } from '../src/workspaceIdentity.ts';
import { reconcileAlertPreferences } from '../src/alertPolicy.ts';
const require = createRequire(resolve('package.json'));
const ts = require('typescript');
const filename = resolve('server/_shared.ts');
const module = new Module(filename);
const workspaces = new Map();
const revisions = new Map();
let revision = 0;
const sql = async (strings, ...values) => {
 const statement = strings.join('?');
 if (/UPDATE tenant_state\s+SET data/.test(statement)) {
  const [data,slug,expected] = values;
  if(!workspaces.has(slug) || revisions.get(slug)!==expected) return [];
  workspaces.set(slug,JSON.parse(data));revisions.set(slug,String(++revision)); return [{slug,revision:revisions.get(slug)}];
 }
 if (/INSERT INTO tenant_state \(slug, data, updated_at\)/.test(statement)) {
  const [slug,data] = values;
  if(!workspaces.has(slug)){workspaces.set(slug,JSON.parse(data));revisions.set(slug,String(++revision));}
 }
 if (/SELECT data, updated_at::text AS revision/.test(statement)) {
  const slug=values[0];return workspaces.has(slug)?[{data:structuredClone(workspaces.get(slug)),revision:revisions.get(slug)}]:[];
 }
 if (/SELECT EXISTS/.test(statement)) return [{exists:workspaces.has(values[0])}];
 return [];
};
module.require = name => name.endsWith("accessPolicy.js") ? loadServerModule("src/accessPolicy.ts") : name.endsWith('patient-registry.js') ? loadServerModule('server/patient-registry.ts') : name.endsWith('workspaceIdentity.js') ? {tenantWorkspaceSlug} : name.endsWith('alertPolicy.js') ? {reconcileAlertPreferences} : name === '@neondatabase/serverless' ? {neon:()=>sql} : require(name);
module._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
const previousUrl=process.env.DATABASE_URL;
process.env.DATABASE_URL='postgresql://fixture.invalid/test';
test('deleted workspace cannot be recreated by ordinary writes; creation remains explicit',async()=>{
 try {
  const db = module.exports.createEmptyDatabase();
  workspaces.set('demo',{untouched:true});
  await module.exports.saveTenantDatabase('deleted',db,true);
  const doomed=await module.exports.loadTenantDatabase('deleted');
  workspaces.delete('deleted');
  await assert.rejects(module.exports.saveTenantDatabase('deleted',doomed),/company portal no longer exists/);
  assert.equal(workspaces.has('deleted'),false);
  assert.deepEqual(workspaces.get('demo'),{untouched:true});
  await module.exports.saveTenantDatabase('new',db,true);
  assert.equal(workspaces.has('new'),true);
  const loaded=await module.exports.loadTenantDatabase('new');
  loaded.settings.accountName='Updated';
  await module.exports.saveTenantDatabase('new',loaded);
  assert.equal(workspaces.get('new').settings.accountName,'Updated');
  await module.exports.saveTenantDatabase('new',db,true);
  assert.equal(workspaces.get('new').settings.accountName,'Updated','creation cannot overwrite existing data');
 } finally {
  if(previousUrl===undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL=previousUrl;
 }
});

test('read models resolve stock preferences from the ledger rather than stale snapshots',()=>{
 const db=module.exports.createEmptyDatabase();
 db.branches=[{id:'a',name:'Central',active:true}];
 db.medicines=[{id:'m',brandName:'Medicine',genericName:'',active:true,reorderLevel:10,unit:'tablet'}];
 db.batches=[{id:'batch',medicineId:'m',branchId:'a',expiryDate:'2028-01-01',batchNumber:'B',location:'Shelf'}];
 db.ledger=[{batchId:'batch',quantity:5,createdAt:new Date().toISOString()}];
 db.stockSnapshot=[{batchId:'batch',quantity:500}];
 db.alertPreferences=[{userId:'u',branchId:'a',key:'low:a:m',mode:'muted',clearedAt:new Date().toISOString()}];
 let rebuilt=module.exports.withReadModels(db);
 assert.equal(rebuilt.stockSnapshot[0].quantity,5);
 assert.equal(rebuilt.alertPreferences.length,1);
 db.ledger.push({batchId:'batch',quantity:10,createdAt:new Date().toISOString()});
 rebuilt=module.exports.withReadModels(db);
 assert.equal(rebuilt.stockSnapshot[0].quantity,15);
 assert.deepEqual(rebuilt.alertPreferences,[]);
});


test('concurrent snapshots cannot overwrite committed stock, profile or assignment changes',async()=>{
 const prior=process.env.DATABASE_URL;process.env.DATABASE_URL='postgresql://fixture.invalid/test';
 try {
  const shared=module.exports;
  await shared.saveTenantDatabase('race',shared.createEmptyDatabase(),true);
  const first=await shared.loadTenantDatabase('race');
  const stale=await shared.loadTenantDatabase('race');
  first.sales=[{id:'sale-synthetic'}];first.settings.accountName='Committed';
  await shared.saveTenantDatabase('race',shared.withReadModels(first));
  stale.settings.accountName='Lost update';
  await assert.rejects(shared.saveTenantDatabase('race',shared.withReadModels(stale)),/workspace changed/);
  assert.equal(workspaces.get('race').settings.accountName,'Committed');
  assert.deepEqual(workspaces.get('race').sales.map(sale=>sale.id),['sale-synthetic']);
  const refreshed=await shared.loadTenantDatabase('race');refreshed.settings.accountName='Refreshed';
  await shared.saveTenantDatabase('race',refreshed);
  assert.equal(workspaces.get('race').settings.accountName,'Refreshed');
  await assert.rejects(shared.saveTenantDatabase('other-workspace',refreshed),/Reload the workspace/);
  const raw=shared.createEmptyDatabase();
  await assert.rejects(shared.saveTenantDatabase('race',raw),/Reload the workspace/);
 } finally {if(prior===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=prior;}
});
