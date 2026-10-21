import type {PatientDetails} from '../patientDetails';
export function AllergyNotice({details,compact=false}:{details?:PatientDetails;compact?:boolean}) {
 const status=details?.allergyStatus || (details?.allergies?.trim() ? 'recorded' : 'unknown');
 if(compact) return <div className={`patient-allergy-notice pos-allergy-summary ${status==='recorded'?'has-allergies':''}`} role="status"><strong>Allergies:</strong><span>{status==='recorded'?details?.allergies:status==='none'?'No known allergies — reconfirm':'Not recorded — ask patient'}</span></div>;
 return <div className={`patient-allergy-notice ${status === 'recorded' ? 'has-allergies' : ''}`} role="status">
 <strong>{status==='recorded'?'Documented allergies':status==='none'?'No known allergies confirmed':'Allergy status not recorded'}</strong>
 <span>{status==='recorded'?details?.allergies:status==='none'?'Previously recorded as no known allergies. Reconfirm with the patient.':'Ask the patient about allergies and record their response before dispensing.'}</span>
 </div>;
}
export function PatientDetailsFields({value,onChange}:{value:PatientDetails;onChange:(value:PatientDetails)=>void}) {
 return <div className="patient-details-fields">
 <label>Age (years)<input type="number" min="0" max="130" step="1" value={value.age ?? ''} onChange={e=>onChange({...value,age:e.target.value===''?undefined:Number(e.target.value)})}/></label>
 <label>Gender<select aria-label="Gender" value={value.gender ?? ''} onChange={e=>onChange({...value,gender:e.target.value as PatientDetails['gender'] || undefined})}><option value="">Not recorded</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
 <label>Allergy status<select aria-label="Allergy status" value={value.allergyStatus} onChange={e=>onChange({...value,allergyStatus:e.target.value as PatientDetails['allergyStatus'],allergies:e.target.value==='recorded'?value.allergies:''})}><option value="unknown">Not recorded / ask patient</option><option value="none">No known allergies confirmed</option><option value="recorded">Allergies documented</option></select></label>
 <label className="patient-specific-allergy">Specific allergy and reaction<textarea aria-label="Specific allergy and reaction" required={value.allergyStatus==='recorded'} maxLength={2000} value={value.allergies} onChange={e=>onChange({...value,allergies:e.target.value,allergyStatus:e.target.value.trim()?'recorded':value.allergyStatus})} placeholder="e.g. Penicillin — rash. Enter the allergen and reaction, if known." rows={2}/></label>
 <p className="patient-details-help">Age is recorded at this visit; reconfirm at later visits. Entering an allergy marks it as documented.</p>
 </div>;
}
