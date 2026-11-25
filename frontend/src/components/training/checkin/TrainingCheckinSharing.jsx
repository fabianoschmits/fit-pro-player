import { useEffect, useState } from 'react'
import { t } from '../../../lib/i18n.js'
import { CHECKIN_REASON_LABELS } from '../../../lib/training-checkin-data.js'
import { createProfessionalWorkflowRepository } from '../../../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../../../lib/supabase-client.js'
export default function TrainingCheckinSharing({ownerScope,selected,shares,onChange}) {
 const [professionals,setProfessionals]=useState(null),[error,setError]=useState(false)
 useEffect(()=>{
  if(ownerScope==='visitor')return undefined
  let alive=true
  const client=getBrowserSupabaseClient()
  if(client)createProfessionalWorkflowRepository({client}).studentProfessionals().then(rows=>{if(alive)setProfessionals(rows)}).catch(()=>{if(alive)setError(true)})
  return()=>{alive=false}
 },[ownerScope])
 if(ownerScope==='visitor')return <p className="small dim">{t('Only you can see this response.')}</p>
 const update=(relationshipId,reasons)=>onChange([...shares.filter(s=>s.relationshipId!==relationshipId),...(reasons.length?[{relationshipId,reasons,sensitiveConsent:reasons.includes('pain_or_discomfort')}]:[])])
 return <fieldset className="checkin-share-controls"><legend>{t('Privacy')}</legend>
 <p className="small">{t('Your note remains private. Only explicitly selected reasons are shared with the chosen professional.')}</p>
 {!professionals&&<p role="status">{t(error?'Sharing is unavailable. Your response can still be saved privately.':'Loading…')}</p>}
 {professionals?.length===0&&<p>{t('Only you can see this response.')}</p>}
 {professionals?.map(pro=>{
  const reasons=shares.find(s=>s.relationshipId===pro.relationshipId)?.reasons||[]
  return <div key={pro.relationshipId}><strong>{pro.professionalName}</strong>
   <label><input type="checkbox" checked={!!reasons.length} onChange={event=>update(pro.relationshipId,event.target.checked?selected.filter(r=>r!=='pain_or_discomfort'):[])}/>{t('Share reasons with this professional')}</label>
   {selected.map(reason=><label key={reason}><input type="checkbox" checked={reasons.includes(reason)} onChange={event=>update(pro.relationshipId,event.target.checked?[...reasons,reason]:reasons.filter(r=>r!==reason))}/>{reason==='pain_or_discomfort'?t('I explicitly authorize sharing my report of pain or discomfort.'):t(CHECKIN_REASON_LABELS[reason])}</label>)}
   <small>{reasons.length?t('Selected reasons are shared. Uncheck them to revoke access.'):t('No reasons shared with this professional.')}</small>
  </div>
 })}
 </fieldset>
}
