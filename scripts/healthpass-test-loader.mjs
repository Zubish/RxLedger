import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const code = stripTypeScriptTypes(readFileSync(new URL('../server/healthpass/workflow.ts',import.meta.url),'utf8')).replace('../branch-scope.js',new URL('../server/branch-scope.ts',import.meta.url).href);
export const workflow = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const sharedCode = stripTypeScriptTypes(readFileSync(new URL('../server/_shared.ts',import.meta.url),'utf8'))
 .replace('../src/alertPolicy.js',new URL('../src/alertPolicy.ts',import.meta.url).href)
 .replace('@vercel/functions',moduleUrl('export function waitUntil() {}'))
 .replace('@neondatabase/serverless',moduleUrl('export function neon() { throw Error("No database allowed in pure mutation test"); }'));
const liveCode = stripTypeScriptTypes(readFileSync(new URL('../server/healthpass/live-authorization.ts',import.meta.url),'utf8'))
 .replace('./auth.js',new URL('../server/healthpass/auth.ts',import.meta.url).href);
const actionCode = stripTypeScriptTypes(readFileSync(new URL('../api/action.ts',import.meta.url),'utf8')+'\nexport { recordSale };')
 .replace('../server/healthpass/workflow.js',moduleUrl(code))
 .replace('../server/healthpass/live-authorization.js',moduleUrl(liveCode))
 .replace('../server/_shared.js',moduleUrl(sharedCode))
 .replace('../server/branch-scope.js',new URL('../server/branch-scope.ts',import.meta.url).href)
 .replace('../src/alertPolicy.js',new URL('../src/alertPolicy.ts',import.meta.url).href)
 .replace('../src/databasePatch.js',new URL('../src/databasePatch.ts',import.meta.url).href);
export const actualActions=await import(moduleUrl(actionCode));
export const liveAuthorization=await import(moduleUrl(liveCode));
