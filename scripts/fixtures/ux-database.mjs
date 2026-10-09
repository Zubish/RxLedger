import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/App.tsx', 'utf8');
const emptyFunction = source.slice(source.indexOf('function createEmptyDatabase()'), source.indexOf('function getStockRows'));
const db = vm.runInNewContext(ts.transpile(emptyFunction + '\ncreateEmptyDatabase()', { target: ts.ScriptTarget.ES2022 }), {
  defaultDosageFormLabelRules: {}, builtInMedicineLabelRules: [], trialPolicy: { includedPlan: 'smart-pharmacy', durationDays: 30 }, today: () => '2026-10-09',
});
const now = new Date().toISOString();
db.settings = { ...db.settings, accountName: 'Audit Pharmacy', companySlug: 'audit', companyCode: 'AUDIT', primaryAdminId: 'admin' };
db.branches = ['a', 'b'].map((id, i) => ({ id, name: i ? 'Riverside Branch' : 'Central Pharmacy', code: id.toUpperCase(), address: '12 Pharmacy Street', managerName: 'Alex', managerUserId: 'staff', phone: '08012345678', active: true, createdAt: now }));
db.users = [{ id: 'admin', name: 'Audit Owner', email: 'owner@example.test', phone: '', role: 'admin', status: 'active', branchIds: ['a','b'], managedBranchIds: [], createdAt: now }, { id: 'staff', name: 'Alex Pharmacist', email: 'staff@example.test', phone: '', role: 'pharmacist', status: 'active', branchIds: ['a'], managedBranchIds: [], createdAt: now }];
db.suppliers = [{ id: 'supplier', name: 'Reliable Medical Supplier', contact: '08012345678', address: 'Main Road', licenseRef: 'LIC-01', active: true }];
db.medicines = Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, sku: `MED-${i}`, brandName: ['Paracetamol','Amoxicillin','Metformin','Amlodipine'][i%4], genericName: 'Medicine generic name', form: 'tablet', strength: '500mg', unit: 'tablet', packSize: 10, sellableUnit: 'tablet', costPrice: 100, sellingPrice: 150, category: 'Medicine', manufacturer: 'Pharma', nafdacNumber: 'NAF-01', barcodes: [], reorderLevel: 10, active: true }));
db.batches = db.medicines.flatMap((m,i) => db.branches.map(b => ({ id: `${m.id}${b.id}`, medicineId: m.id, supplierId: 'supplier', batchNumber: `BATCH-${i}`, expiryDate: i===0 ? '2026-09-01' : i===1 ? '2026-11-01' : '2028-01-01', unitCost: 100, sellingPrice: 150, receivedDate: '2026-10-01', location: 'Shelf 1', branchId: b.id })));
db.stockSnapshot = db.batches.map(b => ({ batchId:b.id, quantity: b.medicineId==='m2' ? 0 : 25 }));
db.products = [{ id:'p1', sku:'MART-1', name:'Skin care lotion', category:'Personal care', unit:'bottle', costPrice:1000, sellingPrice:1500, quantity:20, quantityByBranch:{a:5,b:15}, barcodes:[], supplierId:'supplier', active:true, createdAt:now }];
db.sales = db.branches.map(b => ({ id:`sale-${b.id}`, branchId:b.id, cashierUserId:'staff', customerName: b.id==='a'?'Jane Patient':'Foreign Patient', customerPhone:'08012345678', paymentMethod:'cash', reference:`RX-${b.id}`, note:'', followUpMessage:'Take your medicine as directed. Contact your pharmacist if you have questions or symptoms persist.', soldAt:now, subtotal:1500,discount:0,total:1500,items:[{itemType:'medicine',medicineId:'m0',batchId:`m0${b.id}`,quantity:10,unitPrice:150,lineTotal:1500,daysSupply:30,refillDueAt:'2026-11-01'}] }));
db.sales[1].customerPhone = '08087654321';
db.continuityRequests = ['open','matched','contacted'].map((status,i) => ({ id:`c${i}`, patientName:`Patient ${i+1}`,patientPhone:'08012345678',medicineId:`m${i}`,requestedMedicineName:'Requested medicine',quantityRequested:10,originBranchId:'a',status,urgency:'routine',source:'manual',createdBy:'staff',createdAt:now,updatedAt:now }));
db.ledgerSummary.today = '2026-10-09';
export default db;
