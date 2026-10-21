export const permissionGroups = [
 {name:'Sales',items:[['sales.prepare','Prepare carts'],['sales.complete','Complete sales'],['sales.history','View sales history'],['sales.discount','Apply discounts within existing limits']]},
 {name:'Inventory',items:[['inventory.view','View stock'],['inventory.catalogue','Manage catalogue and suppliers'],['inventory.receive','Receive stock'],['inventory.transfer','Manage stock transfers'],['inventory.issue','Issue stock'],['inventory.adjust','Adjust and write off stock']]},
 {name:'Pricing',items:[['pricing.cost','View costs'],['pricing.edit','Change prices within pricing rules']]},
 {name:'Patients',items:[['patients.view','Find patients and view allergy information'],['patients.edit','Register and edit patients'],['patients.care','View cross-branch care history (professional authority required)']]},
 {name:'Reports',items:[['reports.sales','View sales reconciliation'],['reports.margin','View cost and margin in reconciliation'],['reports.export','Export reports']]},
] as const;
export type Permission = typeof permissionGroups[number]['items'][number][0];
export const allPermissions=permissionGroups.flatMap(group=>group.items.map(item=>item[0])) as Permission[];
export type StaffAccess={title:string;permissions:Permission[];denied:Permission[];revision:number};
export type StaffRole={id:string;name:string;description:string;role:string;permissions:Permission[];revision:number};
type Actor={id:string;role:string;status?:string;managedBranchIds:string[];accessPolicy?:StaffAccess};
export const dependencies:Partial<Record<Permission,Permission[]>>={
 'sales.prepare':['inventory.view','patients.view'],'sales.complete':['sales.prepare'],'sales.discount':['sales.prepare'],
 'inventory.catalogue':['inventory.view'],'inventory.receive':['inventory.view','pricing.cost'],'inventory.transfer':['inventory.view'],'inventory.issue':['inventory.view'],'inventory.adjust':['inventory.view'],
 'pricing.edit':['inventory.view','pricing.cost'],'patients.edit':['patients.view'],'patients.care':['patients.view'],
 'reports.margin':['reports.sales','pricing.cost'],
};
export function addPermission(values:Permission[],permission:Permission):Permission[]{const next=new Set(values);const add=(key:Permission)=>{next.add(key);dependencies[key]?.forEach(add);};add(permission);return [...next];}
export function removePermission(values:Permission[],permission:Permission):Permission[]{const next=new Set(values);next.delete(permission);let changed=true;while(changed){changed=false;for(const key of next)if(dependencies[key]?.some(dep=>!next.has(dep))){next.delete(key);changed=true;}}return [...next];}
export function defaultPermissions(user:Actor):Permission[]{
 const values:Permission[]=['inventory.view','pricing.cost','sales.history','reports.sales','reports.margin','reports.export','patients.view'];
 const manager=user.managedBranchIds.length>0;
 if(['admin','pharmacist','inventory'].includes(user.role))values.push('inventory.catalogue','inventory.receive','inventory.issue');
 if(['admin','pharmacist'].includes(user.role))values.push('inventory.adjust');
 if(['admin','pharmacist','inventory','cashier'].includes(user.role)||manager)values.push('inventory.transfer');
 if(['pharmacist','cashier'].includes(user.role)||manager)values.push('sales.prepare','sales.complete','sales.discount','patients.edit');
 if(user.role==='admin')values.push('patients.edit');
 if(user.role==='inventory'||manager)values.push('pricing.edit');
 if(user.role==='pharmacist'||manager)values.push('patients.care');
 return [...new Set(values)];
}
export function effectivePermissions(user:Actor):Permission[]{
 if(!user.accessPolicy)return defaultPermissions(user);
 let values=user.accessPolicy.permissions.filter(key=>allPermissions.includes(key));
 for(const denied of user.accessPolicy.denied)values=removePermission(values,denied);
 // Corrupt/missing dependencies deny the dependent action; never silently broaden access.
 for(const key of [...values])if(dependencies[key]?.some(dep=>!values.includes(dep)))values=removePermission(values,key);
 return values;
}
export function hasPermission(user:Actor,key:Permission,ownerId=''):boolean{return user.id===ownerId&&user.role==='admin' || effectivePermissions(user).includes(key);}
export const rolePresets=[
 {id:'pharmacist',name:'Pharmacist',role:'pharmacist',permissions:['inventory.view','inventory.catalogue','inventory.receive','inventory.issue','inventory.adjust','inventory.transfer','pricing.cost','sales.prepare','sales.complete','sales.history','sales.discount','patients.view','patients.edit','patients.care','reports.sales','reports.margin','reports.export'] as Permission[]},
 {id:'cashier',name:'Cashier',role:'cashier',permissions:['inventory.view','sales.prepare','sales.complete','sales.history','sales.discount','patients.view'] as Permission[]},
 {id:'inventory',name:'Inventory Officer',role:'inventory',permissions:['inventory.view','inventory.catalogue','inventory.receive','inventory.transfer','inventory.issue','pricing.cost','pricing.edit','reports.export'] as Permission[]},
 {id:'manager',name:'Branch Manager',role:'viewer',permissions:[...allPermissions]},
 {id:'viewer',name:'Read-only / Auditor',role:'viewer',permissions:['inventory.view','sales.history','reports.sales','reports.export'] as Permission[]},
];
export function pagePermission(view:string):Permission|undefined{return ({pos:'sales.prepare',patients:'patients.view',continuity:'patients.view',medicines:'inventory.view',products:'inventory.view',receiving:'inventory.receive',receive:'inventory.receive',suppliers:'inventory.catalogue',transfers:'inventory.transfer',requisitions:'inventory.transfer',issue:'inventory.issue',adjustments:'inventory.adjust',adjust:'inventory.adjust',reports:'inventory.view'} as Record<string,Permission>)[view];}
export function canOpenPage(user:Actor,view:string,ownerId=''):boolean{
 if(!user.accessPolicy||user.id===ownerId&&user.role==='admin')return true;
 if(view==='reports')return hasPermission(user,'inventory.view')||hasPermission(user,'reports.sales');
 const permission=pagePermission(view);return !permission||hasPermission(user,permission);
}
