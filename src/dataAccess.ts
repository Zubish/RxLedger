import type {Database} from "./types.js";
import {hasPermission,type Permission} from "./accessPolicy.js";
export function redactStaffData<T extends Database>(db:T,user:Database['users'][number],alreadyScoped=false):T{
 if(!user.accessPolicy||user.id===db.settings.primaryAdminId && user.role==="admin")return db;
 const next=structuredClone(db),allowed=(key:Permission)=>hasPermission(user,key);
 const branches=new Set(next.branches.map(branch=>branch.id)),batches=new Set(next.batches.map(batch=>batch.id));
 if(!alreadyScoped)next.sales=next.sales.filter(sale=>branches.has(sale.branchId));
 if(!alreadyScoped)next.ledger=next.ledger.filter(entry=>entry.itemType==="product"?branches.has(entry.toBranchId || entry.fromBranchId || ""):batches.has(entry.batchId));
 next.staffRoles=[];
 next.users=next.users.map(staff=>staff.id===user.id?staff:{...staff,accessPolicy:undefined});
 if(!allowed('sales.history'))next.sales=[];
 if(!allowed('sales.prepare'))next.posDrafts=[];
 if(!allowed('patients.view')){
  next.patients=[];next.continuityRequests=[];
  next.sales=next.sales.map(sale=>({...sale,patientId:undefined,customerName:'',customerPhone:'',patientDetails:undefined,patientRiskContext:undefined,patientInfoReliability:undefined,note:'',followUpMessage:undefined,pharmacistReviewNote:undefined,pharmacistReviewOutcome:undefined,safetyReviewSummary:undefined,items:sale.items.map(item=>({...item,counselingNote:undefined,followUpMessage:undefined,labelInstruction:undefined}))}));
 }
 if(!allowed('pricing.cost')){
  next.medicines.forEach(item=>item.costPrice=0);next.products.forEach(item=>item.costPrice=0);next.batches.forEach(item=>item.unitCost=0);
  next.receipts.forEach(receipt=>receipt.items.forEach(item=>item.unitCost=0));next.ledger.forEach(item=>item.unitCost=undefined);
  next.sales.forEach(sale=>sale.items.forEach(item=>item.unitCost=undefined));
  next.settings.globalMarkupPercent=0;next.settings.categoryMarkupPercentages={};next.settings.productMarkupPercentages={};
 }
 if(!allowed('inventory.view')){next.medicines=[];next.products=[];next.batches=[];next.receipts=[];next.ledger=[];next.stockSnapshot=[];next.requisitions=[];}
 return next;
}
