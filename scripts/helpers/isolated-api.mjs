import {readFileSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

/** Real application handlers/SQL, isolated PostgreSQL and synthetic sessions. */
export async function isolatedApi(database, slug='checkout-fixture', userId=database.users[0].id) {
 const postgres=new PGlite();
 const require=createRequire(resolve('package.json'));
 const previousUrl=process.env.DATABASE_URL;
 process.env.DATABASE_URL='postgresql://isolated.invalid/synthetic';
 let beforeSql;
 const sql=async(strings,...values)=>{
  const query=strings.reduce((text,part,index)=>text+(index?`$${index}`:'')+part,'');
  await beforeSql?.({query,values});
  return (await postgres.query(query,values)).rows;
 };
 const cache=new Map();
 function load(relative) {
  const filename=resolve(relative);
  if(cache.has(filename))return cache.get(filename).exports;
  const loaded=new Module(filename);cache.set(filename,loaded);
  loaded.require=name=>name==='@neondatabase/serverless'?{neon:()=>sql}:name.startsWith('.')?load(resolve(filename,'..',name.replace(/\.js$/,'.ts'))):require(name);
  loaded._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
  return loaded.exports;
 }
 const shared=load('server/_shared.ts');
 shared.trackApi=()=>{};shared.logApiPerformance=()=>{};
 await shared.ensureSchema();
 await shared.saveTenantDatabase(slug,database,true);
 const session=await shared.createSession(userId);
 async function invoke(path,body,options={}) {
  const url=new URL(path,'http://isolated.invalid');
  const handler=load(`api/${url.pathname.slice(5)}.ts`).default;
  const req={method:options.method || (body?'POST':'GET'),headers:{'x-rxledger-company':options.slug || slug,authorization:`Bearer ${options.token ?? session.token}`},body,query:Object.fromEntries(url.searchParams)};
  const res={code:200,body:null,status(code){this.code=code;return this;},json(value){this.body=value;},setHeader(){}};
  await handler(req,res);return res;
 }
 return {shared,postgres,invoke,slug,session,
  action:(action,payload,options)=>invoke('/api/action',{action,payload},options),
  read:()=>shared.loadTenantDatabase(slug),
  beforeSql:hook=>{beforeSql=hook;},
  close:async()=>{await postgres.close();if(previousUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousUrl;},
 };
}
