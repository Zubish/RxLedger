import { useEffect, useState } from 'react';
import type { HealthPassState, PharmacyPrescription } from '../healthpassContracts';

type MedicineOption = { id: string; brandName: string; strength: string; form: string; sellableUnit: string; active: boolean };
type Props = { state?: HealthPassState; branchId: string; role: string; medicines: MedicineOption[]; executeAction: (action:string,payload:Record<string,unknown>,message?:string)=>Promise<boolean> };
export function HealthPassQueue(props: Props) {
  const [currentTime,setCurrentTime] = useState(()=>Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setCurrentTime(Date.now()),30000);return()=>window.clearInterval(timer);},[]);
  const records = props.state?.prescriptions.filter(row => row.prescription.pharmacy.branchId === props.branchId) || [];
  if (!['pharmacist','cashier'].includes(props.role)) return null;
  return <section className="panel" aria-label="HealthPass prescriptions">
    <h2>HealthPass prescriptions</h2>
    <p>Review signed orders and record actual supply. Remaining quantities stay pending; receipt does not mean dispensing.</p>
    {!records.length && <p>No prescriptions received for this branch.</p>}
    {records.map(record => <PrescriptionRow key={`${record.prescription.prescriptionId}-${record.prescription.version}`} {...props} record={record} currentTime={currentTime} />)}
  </section>;
}
function PrescriptionRow({record,medicines,role,executeAction,currentTime}:Props & {record:PharmacyPrescription;currentTime:number}) {
  const p = record.prescription;
  const [mappings,setMappings] = useState<Record<string,string>>({});
  const [quantities,setQuantities] = useState<Record<string,number>>({});
  const [operationId,setOperationId] = useState(()=>crypto.randomUUID());
  const [busy,setBusy] = useState(false);
  const [paymentMethod,setPaymentMethod] = useState('cash');
  const [note,setNote] = useState('');
  const expired = Date.parse(p.validUntil) <= currentTime || Date.parse(p.consent.expiresAt) <= currentTime;
  async function review(status:string) {
    setBusy(true);
    try { await executeAction('reviewHealthPassPrescription',{prescriptionId:p.prescriptionId,version:p.version,status,note,mappings:p.items.map(item=>({prescriptionItemId:item.id,medicineId:mappings[item.id]}))},'Prescription review saved'); }
    finally {setBusy(false);}
  }
  async function dispense() {
    const selected = p.items.filter(item=>(quantities[item.id]||0)>0);
    if (!selected.length) return;
    const items = selected.map(item=>({prescriptionItemId:item.id,medicineId:record.mappings.find(m=>m.prescriptionItemId===item.id)?.medicineId,quantity:quantities[item.id]}));
    setBusy(true);
    try {
      const saved = await executeAction('recordSale',{branchId:p.pharmacy.branchId,paymentMethod,discount:0,customerName:p.patient.name,customerPhone:p.patient.contactPhone||'',note,items:items.map(item=>({itemType:'medicine',itemId:item.medicineId,quantity:item.quantity,counselingNote:note,labelInstruction:p.items.find(i=>i.id===item.prescriptionItemId)?.instructions})),healthpass:{prescriptionId:p.prescriptionId,version:p.version,operationId,items}},'Prescription supply recorded; feedback queued for HealthPass');
      if(saved) {setOperationId(crypto.randomUUID());setQuantities({});}
    } finally {setBusy(false);}
  }
  return <details className="panel">
    <summary>{p.prescriptionId} · {p.patient.name || 'Sharing revoked'} · {record.inactive || record.review} · {record.fulfilment}</summary>
    <p>Signed {new Date(p.signedAt).toLocaleString()} · Valid until {new Date(p.validUntil).toLocaleString()}</p>
    <p>Prescriber {p.prescriber.id} · Facility {p.prescriber.facilityId}</p>
    {(record.inactive || expired) && <p role="status">This prescription is inactive or expired. Further supply is unavailable.</p>}
    <div className="table-wrap"><table><thead><tr><th>Prescribed item</th><th>Instructions</th><th>Supply</th><th>Pharmacy action</th></tr></thead><tbody>
      {p.items.map(item=><tr key={item.id}><td>{item.name} {item.strength} {item.form}<br/>{item.dose} {item.doseUnit} · {item.route} · {item.frequency} · {item.duration}</td><td>{item.instructions}</td><td>{record.supplied[item.id]||0} / {item.quantity} {item.dispensingUnit}</td><td>
        {role==='pharmacist' && record.review!=='accepted' && <select aria-label={`Map ${item.name}`} disabled={busy||expired||Boolean(record.inactive)} value={mappings[item.id]||''} onChange={e=>setMappings({...mappings,[item.id]:e.target.value})}><option value="">Select matching medicine</option>{medicines.filter(m=>m.active).map(m=><option value={m.id} key={m.id}>{m.brandName} {m.strength} {m.form} ({m.sellableUnit})</option>)}</select>}
        {record.review==='accepted' && <input type="number" min="0" max={item.quantity-(record.supplied[item.id]||0)} step="any" aria-label={`Supply quantity for ${item.name}`} disabled={busy||expired||Boolean(record.inactive)} value={quantities[item.id]||0} onChange={e=>setQuantities({...quantities,[item.id]:Number(e.target.value)})}/>}
      </td></tr>)}
    </tbody></table></div>
    <label>Review / counselling note<textarea value={note} maxLength={2000} onChange={e=>setNote(e.target.value)} disabled={busy||Boolean(record.inactive)}/></label>
    {role==='pharmacist' && record.review!=='accepted' && <div className="button-row"><button disabled={busy||expired||Boolean(record.inactive)} onClick={()=>void review('accepted')}>Accept mapped prescription</button><button disabled={busy||expired||Boolean(record.inactive)} onClick={()=>void review('clarification_required')}>Request clarification</button><button disabled={busy||expired||Boolean(record.inactive)} onClick={()=>void review('rejected')}>Reject</button></div>}
    {record.review==='accepted' && record.fulfilment!=='complete' && <div className="button-row"><label>Payment method<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} disabled={busy}><option value="cash">Cash</option><option value="card">Card</option><option value="transfer">Transfer</option></select></label><button disabled={busy||expired||Boolean(record.inactive)} onClick={()=>void dispense()}>{busy?'Recording…':'Record actual supply'}</button></div>}
    {record.note && <p>{record.note}</p>}
  </details>;
}
