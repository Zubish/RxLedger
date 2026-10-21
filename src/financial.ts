import type {Sale} from './types.js';

/** NGN is recorded and added in kobo; rounding happens at each line/payment boundary. */
export function moneyAmount(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
export function moneyMinor(value: number): number { return Math.round((value + Number.EPSILON) * 100); }
export type FinancialRow = {
 id:string;reference:string;date:string;branchId:string;branchName?:string;paymentMethod:string;
 gross:number;discount:number;net:number;cost:number|null;grossMargin:number|null;
 cashTendered:number|null;change:number|null;taxStatus:string;issues:string[];
};
export type FinancialReport = {
 generatedAt:string;start:string;end:string;rows:FinancialRow[];
 totals:{sales:number;gross:number;discount:number;net:number;cost:number|null;grossMargin:number|null;missingCostSales:number;issueSales:number;paymentTotals:Record<string,number>};
};
export function financialRows(sales:Sale[]):FinancialRow[] {
 return sales.map(sale=>{
  const issues:string[]=[];
  const sumLines=sale.items.reduce((sum,item)=>sum+moneyMinor(item.lineTotal),0);
  const gross=moneyMinor(sale.subtotal),discount=moneyMinor(sale.discount || 0),net=moneyMinor(sale.total ?? sale.subtotal);
  if(sumLines!==gross)issues.push('Line totals differ from subtotal');
  if(gross-discount!==net)issues.push('Subtotal less discount differs from total');
  if(discount<0 || discount>gross || net<0)issues.push('Invalid sale amounts');
  if(sale.items.some(item=>moneyMinor(item.quantity*item.unitPrice)!==moneyMinor(item.lineTotal)))issues.push('Quantity × price differs from line total');
  const costKnown=sale.items.every(item=>typeof item.unitCost==='number' && Number.isFinite(item.unitCost) && item.unitCost>=0);
  const cost=costKnown?sale.items.reduce((sum,item)=>sum+moneyMinor(item.quantity*item.unitCost!),0):null;
  if(!['cash','card','transfer','mixed'].includes(sale.paymentMethod))issues.push('Unknown payment method');
  if(sale.paymentMethod==='mixed')issues.push('Mixed payment split not recorded');
  if(sale.cashTendered!==undefined && sale.changeGiven!==undefined && moneyMinor(sale.cashTendered)-moneyMinor(sale.changeGiven)!==net)issues.push('Cash tendered less change differs from total');
  return {id:sale.id,reference:sale.reference,date:sale.soldAt,branchId:sale.branchId,paymentMethod:sale.paymentMethod,
   gross:gross/100,discount:discount/100,net:net/100,cost:cost===null?null:cost/100,grossMargin:cost===null?null:(net-cost)/100,
   cashTendered:sale.cashTendered??null,change:sale.changeGiven??null,taxStatus:sale.taxStatus || 'Not recorded',issues};
 });
}
export function summarizeFinancial(rows:FinancialRow[]):FinancialReport['totals'] {
 const sum=(key:'gross'|'discount'|'net')=>rows.reduce((total,row)=>total+moneyMinor(row[key]),0)/100;
 const missingCostSales=rows.filter(row=>row.cost===null).length;
 const cost=missingCostSales?null:rows.reduce((total,row)=>total+moneyMinor(row.cost!),0)/100;
 const net=sum('net');
 const paymentMinor:Record<string,number>={};
 rows.forEach(row=>{paymentMinor[row.paymentMethod]=(paymentMinor[row.paymentMethod] || 0)+moneyMinor(row.net);});
 return {sales:rows.length,gross:sum('gross'),discount:sum('discount'),net,cost,grossMargin:cost===null?null:moneyAmount(net-cost),missingCostSales,issueSales:rows.filter(row=>row.issues.length).length,
  paymentTotals:Object.fromEntries(Object.entries(paymentMinor).map(([key,value])=>[key,value/100]))};
}
