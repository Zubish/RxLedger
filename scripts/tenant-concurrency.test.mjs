import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
let stored;
globalThis.__rxLedgerConcurrencySql = async (strings,...values) => {
 const sql = strings.join('?');
 if (/SELECT data\s+FROM tenant_state/.test(sql)) return stored ? [{data:structuredClone(stored)}] : [];
 if (/UPDATE tenant_state\s+SET data/.test(sql)) {
  if (!stored) return [];
  const baseline = values[2];
  if (baseline && JSON.stringify(stored)!==JSON.stringify(JSON.parse(baseline))) return [];
  stored=JSON.parse(values[0]);return [{slug:values[1]}];
 }
 return [];
};
const source = stripTypeScriptTypes(readFileSync(new URL('../server/_shared.ts',import.meta.url),'utf8'))
 .replace('../src/alertPolicy.js',new URL('../src/alertPolicy.ts',import.meta.url).href)
 .replace('@vercel/functions',dataUrl('export function waitUntil() {}'))
 .replace('@neondatabase/serverless',dataUrl('export function neon() { return globalThis.__rxLedgerConcurrencySql; }'));
const shared=await import(dataUrl(source));
test('competing tenant writes cannot overwrite newer dispensing state and baseline survives read models',async()=>{
 const old=process.env.DATABASE_URL;process.env.DATABASE_URL='postgresql://synthetic.invalid/test';
 try {
  stored=shared.createEmptyDatabase();stored.settings.companySlug='pharmacy';
  const first=await shared.loadTenantDatabase('pharmacy'),second=await shared.loadTenantDatabase('pharmacy');
  first.settings.accountName='first sale';await shared.saveTenantDatabase('pharmacy',shared.withReadModels(first));
  second.settings.accountName='competing sale';await assert.rejects(shared.saveTenantDatabase('pharmacy',shared.withReadModels(second)),/concurrently/);
  assert.equal(stored.settings.accountName,'first sale');
  const fresh=await shared.loadTenantDatabase('pharmacy');fresh.settings.accountName='reconciled';await shared.saveTenantDatabase('pharmacy',fresh);
  fresh.settings.accountName='next mutation';await shared.saveTenantDatabase('pharmacy',fresh);
  assert.equal(stored.settings.accountName,'next mutation');
 } finally {if(old===undefined) delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;delete globalThis.__rxLedgerConcurrencySql;}
});
