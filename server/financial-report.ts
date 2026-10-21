import {hasPermission} from "../src/accessPolicy.js";
import {accessibleBranchIds,primaryAdminIdForDatabase} from './branch-scope.js';
import {getAuthenticatedUser,getCompanySlugFromRequest,loadTenantDatabase,requireMethod,fail} from './_shared.js';
import type {HandlerRequest,HandlerResponse} from './_shared.js';
import {financialRows,summarizeFinancial} from '../src/financial.js';

export default async function handler(req:HandlerRequest & {query?:Record<string,string|string[]|undefined>},res:HandlerResponse) {
 if(!requireMethod(req,res,['GET']))return;
 try {
  const slug=getCompanySlugFromRequest(req);
  if(!slug){fail(res,400,'Choose a company portal');return;}
  const db=await loadTenantDatabase(slug);
  if(!db){fail(res,404,'Company portal not found');return;}
  const user=await getAuthenticatedUser(req,db);
  if(!user){fail(res,401,'Authentication required');return;}
  if(user.accessPolicy && !hasPermission(user,"reports.sales",primaryAdminIdForDatabase(db))){fail(res,403,"Sales reports are not included in your staff access");return;}
  if(req.query?.export && user.accessPolicy && !hasPermission(user,"reports.export",primaryAdminIdForDatabase(db))){fail(res,403,"Report export is not included in your staff access");return;}
  const ids=accessibleBranchIds(user,primaryAdminIdForDatabase(db));
  const param=(key:string)=>String(req.query?.[key] || '');
  const branchId=param('branchId');
  if(branchId && (ids!==null && !ids.includes(branchId) || !db.branches.some(branch=>branch.id===branchId))){fail(res,403,'Branch is outside your access');return;}
  const today=new Date().toISOString().slice(0,10),start=param('start') || today,end=param('end') || today;
  const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
  if(!valid(start) || !valid(end) || start>end || (Date.parse(end)-Date.parse(start))/86400000>365){fail(res,400,'Choose a valid date range of at most 366 days (UTC)');return;}
  const sales=db.sales.filter(sale=>(ids===null || ids.includes(sale.branchId)) && (!branchId || sale.branchId===branchId) && sale.soldAt.slice(0,10)>=start && sale.soldAt.slice(0,10)<=end);
  if(sales.length>10000){fail(res,400,'This period exceeds 10,000 sales. Choose a shorter date range.');return;}
  const rows=financialRows(sales).sort((a,b)=>b.date.localeCompare(a.date));
  // Reconcile signed POS movements independently; never infer refunds from stock returns.
  const ledgerByReference=new Map<string,typeof db.ledger>();
  db.ledger.filter(entry=>entry.reason==='POS sale').forEach(entry=>ledgerByReference.set(entry.reference,[...(ledgerByReference.get(entry.reference)||[]),entry]));
  const salesById=new Map(sales.map(sale=>[sale.id,sale]));
  for(const row of rows){
   const sale=salesById.get(row.id)!;
   row.branchName=db.branches.find(branch=>branch.id===row.branchId)?.name || row.branchId;
   const key=(item:{itemType?:string;productId?:string;batchId?:string})=>item.itemType==='product'?`p:${item.productId}`:`b:${item.batchId}`;
   const expected=new Map<string,number>(),actual=new Map<string,number>();
   sale.items.forEach(item=>expected.set(key(item),(expected.get(key(item))||0)+item.quantity));
   (ledgerByReference.get(sale.reference)||[]).forEach(entry=>actual.set(key(entry),(actual.get(key(entry))||0)-entry.quantity));
   if([...new Set([...expected.keys(),...actual.keys()])].some(key=>Math.abs((expected.get(key)||0)-(actual.get(key)||0))>1e-8))row.issues.push('POS stock movements differ from sold quantities');
  }
  const costRestricted=Boolean(user.accessPolicy && !hasPermission(user,"reports.margin",primaryAdminIdForDatabase(db)));
  if(costRestricted)rows.forEach(row=>{row.cost=null;row.grossMargin=null;});
  res.status(200).json({costRestricted,generatedAt:new Date().toISOString(),start,end,rows,totals:summarizeFinancial(rows)});
 }catch{fail(res,500,'Sales reconciliation is unavailable. Try again.');}
}
