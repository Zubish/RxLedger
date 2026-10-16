import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function pricing(file) {
 const source=readFileSync(file,'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const names=['normalizeMarkupMap','pricingPolicy','roundSellingPrice','productSpecificKeys','markupForItem','calculatedSellingPrice','medicineUnitsPerContainer','medicineUnitCostFromContainerCost'];
 const code=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText(ast)).join('\n');
 return vm.runInNewContext(ts.transpile(code+'\n({pricingPolicy,roundSellingPrice,calculatedSellingPrice,...(typeof medicineUnitCostFromContainerCost === "undefined" ? {} : {medicineUnitCostFromContainerCost})})',{target:ts.ScriptTarget.ES2022}));
}
for(const file of ['src/App.tsx','api/action.ts']) {
 const p=pricing(file);
 test(file+': preset and custom nearest rounding, including fractional currency',()=>{
  for(const [value,increment,expected] of [[1326,0,1326],[1326,10,1330],[1326,50,1350],[1326,25,1325],[1301,10,1300],[10.13,.25,10.25]])assert.equal(p.roundSellingPrice(value,increment),expected);
  assert.equal(p.pricingPolicy({pricingRoundingRule:25}).roundingRule,25);
  assert.equal(p.pricingPolicy({pricingRoundingRule:-5}).roundingRule,10);
 });
 test(file+': medicine/product overrides win and rounded targets never go below cost',()=>{
  const item={id:'m',sku:'SKU',brandName:'Example',genericName:'Generic',category:'pain',nafdacNumber:''};
  const db={settings:{globalMarkupPercent:30,pricingRoundingRule:25,categoryMarkupPercentages:{pain:40},productMarkupPercentages:{'medicine:m':50}},medicines:[item],products:[{...item,name:'Retail'}]};
  const value=(type,id,cost)=>{const result=p.calculatedSellingPrice(db,type,id,cost);return typeof result==='number'?result:result.price;};
  assert.equal(value('medicine','m',1000),1500);
  assert.equal(value('product','m',1000),1400);
  db.settings.productMarkupPercentages={};db.settings.categoryMarkupPercentages={};
  assert.equal(value('medicine','m',1020),1325);
  db.settings.globalMarkupPercent=0;assert.equal(value('medicine','m',1010),1010);
 });
}

test('a 28-tablet container costing 2800 uses 100 cost per tablet before markup',()=>{
 const p=pricing('src/App.tsx');
 const cost=p.medicineUnitCostFromContainerCost({packSize:28,costPrice:0},2800);
 assert.equal(cost,100);
 const db={settings:{globalMarkupPercent:30,pricingRoundingRule:0},medicines:[],products:[]};
 assert.equal(p.calculatedSellingPrice(db,'medicine','missing',cost).price,130);
});
