import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve('package.json'));
const ts = require('typescript');
const filename = resolve('server/_shared.ts');
const module = new Module(filename);
const workspaces = new Map();
const sql = async (strings, ...values) => {
 const statement = strings.join('?');
 if (/UPDATE tenant_state\s+SET data/.test(statement)) {
  const [data,slug] = values;
  if(!workspaces.has(slug)) return [];
  workspaces.set(slug,JSON.parse(data)); return [{slug}];
 }
 if (/INSERT INTO tenant_state \(slug, data, updated_at\)/.test(statement)) {
  const [slug,data] = values;
  if(!workspaces.has(slug)) workspaces.set(slug,JSON.parse(data));
 }
 return [];
};
module.require = name => name === '@neondatabase/serverless' ? {neon:()=>sql} : require(name);
module._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
const previousUrl=process.env.DATABASE_URL;
process.env.DATABASE_URL='postgresql://fixture.invalid/test';
test('deleted workspace cannot be recreated by ordinary writes; creation remains explicit',async()=>{
 try {
  const db = module.exports.createEmptyDatabase();
  workspaces.set('demo',{untouched:true});
  await assert.rejects(module.exports.saveTenantDatabase('deleted',db),/company portal no longer exists/);
  assert.equal(workspaces.has('deleted'),false);
  assert.deepEqual(workspaces.get('demo'),{untouched:true});
  await module.exports.saveTenantDatabase('new',db,true);
  assert.equal(workspaces.has('new'),true);
  await module.exports.saveTenantDatabase('new',{...db,settings:{...db.settings,accountName:'Updated'}});
  assert.equal(workspaces.get('new').settings.accountName,'Updated');
  await module.exports.saveTenantDatabase('new',db,true);
  assert.equal(workspaces.get('new').settings.accountName,'Updated','creation cannot overwrite existing data');
 } finally {
  if(previousUrl===undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL=previousUrl;
 }
});
