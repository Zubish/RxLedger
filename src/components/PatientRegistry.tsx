import {useEffect,useRef,useState,type ReactNode,type FormEvent} from 'react';
import {X} from 'lucide-react';
import type {ActionResult} from '../api';
import type {PatientRecord,PatientCareVisit} from '../patientRegistry';
import {normalizePatientPhone,patientMatchesPhone} from '../patientRegistry';
import type {PatientDetails} from '../patientDetails';
import {PatientDetailsFields} from './PatientDetailsFields';
import './PatientRegistry.css';

type Action = (action:string,payload:Record<string,unknown>,message?:string,callbacks?:{onResult?:(result:ActionResult)=>void})=>Promise<boolean>;
function RegistryDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const previous=document.activeElement;
  const element=dialog.current;
  element?.showModal();
  return ()=>{element?.close();if(previous instanceof HTMLElement && previous.isConnected)previous.focus();};
 },[]);
 return <dialog ref={dialog} className="patient-registry-dialog" aria-label={title} onCancel={event=>{event.preventDefault();onClose();}}>
  <header><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close patient dialog" onClick={onClose}><X size={20}/></button></header>
  {children}
 </dialog>;
}
export function PatientRegistrationDialog({branchId,patients,initialName='',initialPhone='',executeAction,onSaved,onClose}:{branchId:string;patients:PatientRecord[];initialName?:string;initialPhone?:string;executeAction:Action;onSaved:(patient:PatientRecord)=>void;onClose:()=>void}) {
 const [name,setName]=useState(initialName),[phone,setPhone]=useState(initialPhone);
 const [details,setDetails]=useState<PatientDetails>({allergyStatus:'unknown',allergies:''});
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false);
 const matches=patients.filter(patient=>patientMatchesPhone(patient,phone) && normalizePatientPhone(phone));
 async function submit(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);
  try {await executeAction('createPatient',{branchId,patientName:name,patientPhone:phone,patientDetails:details,sharedPhoneReason:reason},'Workspace patient registered',{onResult:result=>{if(result.patient)onSaved(result.patient);}});}
  finally {setBusy(false);}
 }
 return <RegistryDialog title="Register workspace patient" onClose={onClose}>
  <p>This profile is recognised at every branch of this pharmacy workspace.</p>
  <form onSubmit={event=>void submit(event)}><fieldset disabled={busy}>
   <div className="registry-identity-fields"><label>Patient name<input autoFocus required maxLength={160} value={name} onChange={event=>setName(event.target.value)}/></label><label>Patient phone<input required type="tel" value={phone} onChange={event=>setPhone(event.target.value)}/></label></div>
   {matches.length>0 && <section className="registry-phone-matches"><strong>This contact already has a profile. Confirm who you are serving.</strong>{matches.map(patient=><button className="ghost-button" type="button" key={patient.id} onClick={()=>onSaved(patient)}><b>{patient.name}</b><span>{patient.phone}{patient.details.age!==undefined?` · Age ${patient.details.age}`:''}</span></button>)}<label>Reason this is a different person sharing the contact<input required value={reason} onChange={event=>setReason(event.target.value)} placeholder="e.g. Parent's phone shared with their child"/></label></section>}
   <PatientDetailsFields value={details} onChange={setDetails}/>
   <footer><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{busy?'Registering…':'Register patient'}</button></footer>
  </fieldset></form>
 </RegistryDialog>;
}
export function PatientCareHistoryButton({patientId,branchId,executeAction}:{patientId:string;branchId:string;executeAction:Action}) {
 const [visits,setVisits]=useState<PatientCareVisit[]|null>(null),[busy,setBusy]=useState(false);
 async function open(){if(busy)return;setBusy(true);try{await executeAction('getPatientCareHistory',{patientId,branchId},undefined,{onResult:result=>setVisits(result.patientCareHistory || [])});}finally{setBusy(false);}}
 return <><button type="button" className="ghost-button patient-care-history-button" onClick={()=>void open()} disabled={busy}>{busy?'Loading care history…':'Care history across branches'}</button>
 {visits && <RegistryDialog title="Care history across branches" onClose={()=>setVisits(null)}><p>Medication visits for this patient. Branch sales and financial reports retain their existing access rules.</p><div className="registry-care-visits">{visits.map(visit=><article key={visit.id}><strong>{new Date(visit.date).toLocaleDateString()} · {visit.branchName}</strong><ul>{visit.items.map((item,index)=><li key={index}>{item.name} · Qty {item.quantity}{item.daysSupply?` · ${item.daysSupply} therapy days`:''}{item.instruction && <p>{item.instruction}</p>}</li>)}</ul></article>)}{!visits.length && <p>No recorded medicine visits for this patient.</p>}</div></RegistryDialog>}
 </>;
}
function reviewedDetails(source:PatientRecord,target:PatientRecord):PatientDetails {
 const allergies=[source.details,target.details].filter(details=>details.allergyStatus==='recorded').map(details=>details.allergies).filter(Boolean);
 return {...target.details,...(allergies.length?{allergyStatus:'recorded' as const,allergies:[...new Set(allergies)].join('; ')}:{})};
}
export function PatientMergeDialog({source,patients,executeAction,onSaved,onClose}:{source:PatientRecord;patients:PatientRecord[];executeAction:Action;onSaved:(patient:PatientRecord)=>void;onClose:()=>void}) {
 const targets=patients.filter(patient=>patient.id!==source.id);
 const initial=targets.find(patient=>patient.normalizedPhone===source.normalizedPhone)||targets[0];
 const [targetId,setTargetId]=useState(initial?.id || ''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
 const [details,setDetails]=useState<PatientDetails>(initial?reviewedDetails(source,initial):source.details);
 const target=targets.find(patient=>patient.id===targetId);
 async function submit(event:FormEvent){event.preventDefault();if(busy || !target || !confirmed)return;setBusy(true);try{await executeAction('mergeRegistryPatients',{sourcePatientId:source.id,targetPatientId:target.id,sourceRevision:source.revision || 0,targetRevision:target.revision || 0,reason,identityConfirmed:confirmed,patientDetails:details},'Patient identities merged',{onResult:result=>{if(result.patient)onSaved(result.patient);}});}finally{setBusy(false);}}
 return <RegistryDialog title="Review patient identity merge" onClose={onClose}><p>Merge only after confirming these profiles belong to the same person. Visits retain their branch and original transaction details.</p>
 <form onSubmit={event=>void submit(event)}><fieldset disabled={busy}><p><b>Source:</b> {source.name} · {source.phone}</p><label>Keep this patient profile<select aria-label="Keep this patient profile" required value={targetId} onChange={event=>{setTargetId(event.target.value);const next=targets.find(patient=>patient.id===event.target.value);if(next)setDetails(reviewedDetails(source,next));}}>{targets.map(patient=><option key={patient.id} value={patient.id}>{patient.name} · {patient.phone}</option>)}</select></label>
 <section className="registry-merge-review"><p><b>Source allergies:</b> {source.details.allergies || source.details.allergyStatus}</p><p><b>Target allergies:</b> {target?.details.allergies || target?.details.allergyStatus}</p></section>
 <PatientDetailsFields value={details} onChange={setDetails}/><label>How identity was confirmed<textarea required value={reason} onChange={event=>setReason(event.target.value)}/></label><label className="registry-confirm"><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>I confirmed the same person and reviewed the final allergy information.</label>
 <footer><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={!target || !confirmed}>{busy?'Merging…':'Merge confirmed patient'}</button></footer></fieldset></form>
 </RegistryDialog>;
}
