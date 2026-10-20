import type {PatientDetails} from '../patientDetails';
export function AllergyNotice({details}:{details?:PatientDetails}) {
 const status=details?.allergyStatus || (details?.allergies?.trim() ? 'recorded' : 'unknown');
 return <div className={`patient-allergy-notice ${status === 'recorded' ? 'has-allergies' : ''}`} role="status">
 <strong>{status==='recorded'?'Documented allergies':status==='none'?'No known allergies confirmed':'Allergy status not recorded'}</strong>
 <span>{status==='recorded'?details?.allergies:status==='none'?'Previously recorded as no known allergies. Reconfirm with the patient.':'Ask the patient about allergies and record their response before dispensing.'}</span>
 </div>;
}
export function PatientDetailsFields({value,onChange}:{value:PatientDetails;onChange:(value:PatientDetails)=>void}) {
 return <div className="patient-details-fields">
 <label>Age (years)<input type="number" min="0" max="130" step="1" value={value.age ?? ''} onChange={e=>onChange({...value,age:e.target.value===''?undefined:Number(e.target.value)})}/><small>Age at the time of recording; reconfirm at later visits.</small></label>
 <label>Gender<select value={value.gender ?? ''} onChange={e=>onChange({...value,gender:e.target.value as PatientDetails['gender'] || undefined})}><option value="">Not recorded</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
 <label>Allergy status<select value={value.allergyStatus} onChange={e=>onChange({...value,allergyStatus:e.target.value as PatientDetails['allergyStatus'],allergies:e.target.value==='recorded'?value.allergies:''})}><option value="unknown">Not recorded / ask patient</option><option value="none">No known allergies confirmed</option><option value="recorded">Allergies documented</option></select></label>
 {value.allergyStatus==='recorded'&&<label>Allergies and reaction<textarea required maxLength={2000} value={value.allergies} onChange={e=>onChange({...value,allergies:e.target.value})} placeholder="Allergen and reported reaction, if known" rows={3}/></label>}
 </div>;
}
