import {allPermissions,dependencies,effectivePermissions,hasPermission,type Permission} from '../src/accessPolicy.js';
import {addAudit,canAdmin,nowIso} from './_shared.js';
import type {Database} from './_shared.js';
const getPrimaryAdminId=(db:Database)=>db.settings.primaryAdminId || db.users.find(user=>user.role==="admin"&&user.status==="active")?.id || "";
const accessSnapshot=(user:Database["users"][number])=>({id:user.id,role:user.role,status:user.status,branchIds:[...user.branchIds],managedBranchIds:[...user.managedBranchIds],branchAccessExpiresAt:{...user.branchAccessExpiresAt},accessPolicy:user.accessPolicy?structuredClone(user.accessPolicy):undefined,accessRevision:user.accessRevision});
const list=(value:unknown):Permission[]=>{
 if(!Array.isArray(value)||value.some(key=>!allPermissions.includes(key as Permission)))throw new Error('Choose valid supported permissions');
 return [...new Set(value)] as Permission[];
};
export function saveStaffAccess(db:Database,actorId:string,payload:Record<string,unknown>|undefined){
 const actor=db.users.find(user=>user.id===actorId),owner=getPrimaryAdminId(db);
 if(!actor||!canAdmin(actor,owner))throw new Error('Only the workspace owner can manage staff access');
 const target=db.users.find(user=>user.id===payload?.userId);
 if(!target || target.id===owner)throw new Error('The workspace owner’s access is protected');
 if(Number(payload?.expectedRevision)!==(target.accessRevision || target.accessPolicy?.revision || 0))throw new Error('Staff access changed. Refresh and review before saving');
 const role=String(payload?.role),title=String(payload?.title || '').trim();
 if(!['admin','pharmacist','cashier','inventory','viewer'].includes(role)||!title||title.length>100)throw new Error('Choose a role and a short job title');
 const permissions=list(payload?.permissions),denied=list(payload?.denied);
 if(permissions.some(key=>dependencies[key]?.some(dep=>!permissions.includes(dep))))throw new Error('Required permissions are missing');
 if(permissions.includes('patients.care') && role!=='pharmacist' && !target.managedBranchIds.length)throw new Error('Care history requires pharmacist or existing branch-manager authority');
 if(typeof payload?.reason!=='string'||!payload.reason.trim())throw new Error('Explain this access change');
 if(payload.reason.length>500)throw new Error('Keep the access reason within 500 characters');
 const branches=Array.isArray(payload?.branchIds)?[...new Set(payload.branchIds.map(String))]:[];
 if(branches.some(branch=>!db.branches.some(item=>item.id===branch&&item.active)))throw new Error('Choose active workspace branches');
 if(target.managedBranchIds.some(branch=>!branches.includes(branch)))throw new Error('Release existing branch-manager assignments before removing their branch access');
 const expiryInput=payload?.branchAccessExpiresAt;
 if(expiryInput!==undefined && (!expiryInput || typeof expiryInput!=="object" || Array.isArray(expiryInput)))throw new Error('Choose valid branch expiry dates');
 const expiries=Object.fromEntries(branches.map(branch=>[branch, String(expiryInput!==undefined?(expiryInput as Record<string,unknown>)[branch] || '':payload?.expiresAt || '')]));
 if(Object.values(expiries).some(expiresAt=>expiresAt && (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)||!Number.isFinite(Date.parse(expiresAt))||new Date(expiresAt).toISOString().slice(0,10)!==expiresAt||expiresAt<nowIso().slice(0,10))))throw new Error('Choose a valid future access expiry');
 const before=accessSnapshot(target);
 target.role=role as typeof target.role;target.branchIds=branches;
 target.branchAccessExpiresAt=expiries;
 target.accessPolicy={title,permissions,denied,revision:(target.accessRevision || target.accessPolicy?.revision || 0)+1};
 addAudit(db,actorId,'Updated staff permissions','user',target.id,before,{...accessSnapshot(target),reason:payload.reason.trim(),effectivePermissions:effectivePermissions(target)});
}
export function saveStaffRole(db:Database,actorId:string,payload:Record<string,unknown>|undefined){
 const actor=db.users.find(user=>user.id===actorId);
 if(!actor||!canAdmin(actor,getPrimaryAdminId(db)))throw new Error('Only the workspace owner can save role templates');
 const name=String(payload?.name || '').trim(),description=String(payload?.description || '').trim(),role=String(payload?.role || 'viewer');
 if(!name||name.length>100||description.length>500||!['pharmacist','cashier','inventory','viewer','admin'].includes(role))throw new Error('Enter a valid role template');
 const permissions=list(payload?.permissions);
 if(permissions.some(key=>dependencies[key]?.some(dep=>!permissions.includes(dep))))throw new Error('Required permissions are missing');
 if((db.staffRoles || []).some(item=>item.name.toLowerCase()===name.toLowerCase()))throw new Error('A role template already uses this name');
 const record={id:crypto.randomUUID(),name,description,role,permissions,revision:1};
 db.staffRoles=[...(db.staffRoles || []),record];
 addAudit(db,actorId,'Created staff role template','staff-role',record.id,undefined,record);
}
export const actionPermissions:Record<string,Permission>={
 upsertMedicine:'inventory.catalogue',upsertMedicines:'inventory.catalogue',upsertProduct:'inventory.catalogue',upsertSupplier:'inventory.catalogue',receiveStock:'inventory.receive',issueStock:'inventory.issue',adjustStock:'inventory.adjust',updateSellingPrice:'pricing.edit',
 createRequisition:'inventory.transfer',fulfillRequisition:'inventory.transfer',receiveRequisition:'inventory.transfer',rejectRequisition:'inventory.transfer',
 createContinuityRequest:'patients.edit',updateContinuityRequest:'patients.edit',createPatient:'patients.edit',updateRegistryPatient:'patients.edit',updatePatientProfile:'patients.edit',getRegistryPatient:'patients.view',refreshPatientRegistry:'patients.view',getPatientCareHistory:'patients.care',
 recordSale:'sales.complete',getCheckoutStatus:'sales.complete',cancelCheckout:'sales.complete',savePosDraft:'sales.prepare',clearPosDraft:'sales.prepare',
};
export function enforceActionPermission(db:Database,actor:Database['users'][number],action:string){
 const permission=actionPermissions[action];
 if(permission && actor.accessPolicy && !action.startsWith("get") && !action.startsWith("refresh") && !canAdmin(actor,getPrimaryAdminId(db)) && !db.branches.some(branch=>branch.active && [...actor.branchIds,...actor.managedBranchIds].includes(branch.id) && (!actor.branchAccessExpiresAt?.[branch.id] || actor.branchAccessExpiresAt[branch.id]>=nowIso().slice(0,10))))throw new Error("An active branch assignment is required");
 if(permission && actor.accessPolicy && !hasPermission(actor,permission,getPrimaryAdminId(db)))throw new Error('Your staff access does not allow this action');
}
export {redactStaffData} from "../src/dataAccess.js";
