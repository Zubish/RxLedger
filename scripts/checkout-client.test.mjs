import assert from 'node:assert/strict';
import test from 'node:test';
import {runAction,ApiError} from '../src/api.ts';

const originalFetch=globalThis.fetch;
const originalStorage=globalThis.localStorage;
const originalTimeout=globalThis.setTimeout;
function reset(){globalThis.fetch=originalFetch;globalThis.localStorage=originalStorage;globalThis.setTimeout=originalTimeout;}

test('checkout transport bounds a hanging response and never silently resubmits',async()=>{
 let calls=0;
 globalThis.localStorage={getItem:()=> 'synthetic'};
 globalThis.setTimeout=(callback,delay,...args)=>originalTimeout(callback,delay===20_000?5:delay,...args);
 globalThis.fetch=async(_path,options)=>{
  calls++;
  return new Promise((_resolve,reject)=>{
   if(options.signal.aborted)reject(options.signal.reason);
   else options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
  });
 };
 try {await assert.rejects(runAction('recordSale',{operationId:'synthetic'}),error=>error.name==='AbortError');assert.equal(calls,1);}
 finally {reset();}
});
test('a definite rejection remains distinguishable from an uncertain save failure',async()=>{
 globalThis.localStorage={getItem:()=> 'synthetic'};
 try {for(const checkoutState of ['rejected','unknown']) {
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'Synthetic checkout response',checkoutState}),{status:400,headers:{'content-type':'application/json'}});
  await assert.rejects(runAction('recordSale',{}),error=>error instanceof ApiError && error.status===400 && error.checkoutState===checkoutState);
 }}finally{reset();}
});

test('truncated or incomplete success responses never masquerade as confirmed actions',async()=>{
 globalThis.localStorage={getItem:()=> 'synthetic'};
 try {for(const body of ['{"checkout":', '{}', 'null', '[]']) {
  globalThis.fetch=async()=>new Response(body,{status:200,headers:{'content-type':'application/json'}});
  await assert.rejects(runAction('recordSale',{}),/interrupted|incomplete/);
 }}finally{reset();}
});
