import { normalizeTrainingCheckin } from './training-checkin-data.js'
export const checkinFromRow = row => ({...normalizeTrainingCheckin({version:row.version,status:row.status,reasons:row.reasons,note:row.note,operationId:row.operation_id,answeredAt:row.answered_at,updatedAt:row.updated_at,dismissedAt:row.dismissed_at,removedAt:row.removed_at}),revision:Number(row.revision),id:row.id})
export function createTrainingCheckinRepository(client) {
 return {
  async load() {
   // Owner RLS applies even without an explicit client-side owner predicate.
   const rows=[], shares=[]
   for(let offset=0;;offset+=200) {
    const result=await client.from('training_checkins').select('*').order('workout_id').range(offset,offset+199)
    if(result.error)throw result.error
    rows.push(...result.data)
    if(result.data.length<200)break
   }
   for(let offset=0;;offset+=200) {
    const result=await client.from('training_checkin_shares').select('checkin_id,relationship_id,shared_reasons,revoked_at').order('checkin_id').order('relationship_id').range(offset,offset+199)
    if(result.error)throw result.error
    shares.push(...result.data)
    if(result.data.length<200)break
   }
   return Object.fromEntries(rows.map(row=>[row.workout_id,{...checkinFromRow(row),shares:shares.filter(s=>s.checkin_id===row.id&&!s.revoked_at).map(s=>({relationshipId:s.relationship_id,reasons:s.shared_reasons,sensitiveConsent:s.shared_reasons.includes('pain_or_discomfort')}))}]))
  },
  async save(operation) {
   const result=await client.rpc('save_training_checkin',{p_workout_id:operation.workoutId,p_record:operation.record,p_expected_revision:operation.expectedRevision,p_operation_id:operation.operationId,p_shares:operation.shares??null,p_import:!!operation.import})
   if(result.error)throw result.error
   return checkinFromRow(result.data)
  },
 }
}
export function queueCheckin(state,accountId,workoutId,record,shares=null,importLegacy=false) {
 if(record.status!=='answered')shares=[]
 const pending=state.pendingCheckinOperations||[]
 const current=state.trainingCheckinRecords?.[workoutId]
 const ahead=pending.filter(op=>op.accountId===accountId&&op.workoutId===workoutId)
 const operation={accountId,workoutId,operationId:record.operationId||crypto.randomUUID(),record,shares,import:importLegacy,expectedRevision:(current?.revision||0)+ahead.length}
 const visibleShares=(shares??current?.shares??[]).map(share=>({...share,reasons:share.reasons.filter(reason=>record.reasons?.includes(reason))})).filter(share=>share.reasons.length)
 return {...state,trainingCheckinRecords:{...state.trainingCheckinRecords,[workoutId]:{...record,revision:current?.revision||0,shares:visibleShares}},pendingCheckinOperations:[...pending,operation]}
}
/** Adapter for the existing scoped durable-journal lifecycle; no polling or extra store. */
export function createTrainingCheckinSync({repository,getState,replaceState,isCurrent,isOnline,accountId}) {
 let running=null,disposed=false
 const current=()=>!disposed&&isCurrent()
 let persistenceFailed=false
 const replace=next=>{if(!current()||persistenceFailed)return false;if(replaceState(next)===false){persistenceFailed=true;return false}return true}
 const flush=()=> {
  if(running)return running
  running=(async()=>{
   if(!current()||!isOnline()||persistenceFailed)return
   try {
    const remote=await repository.load()
    if(!current())return
    const state=getState(),pending=state.pendingCheckinOperations||[],legacy=state.trainingCheckIns||{}
    const records={...remote}
    for(const op of pending)if(op.accountId===accountId&&state.trainingCheckinRecords?.[op.workoutId])records[op.workoutId]=state.trainingCheckinRecords[op.workoutId]
    const conflicts={...state.checkinConflicts}
    for(const id of Object.keys(conflicts))conflicts[id]={...conflicts[id],remote:remote[id]??null}
    let next={...state,trainingCheckinRecords:records,checkinConflicts:conflicts,checkinSyncError:Object.keys(conflicts).length?'conflict':null}
    for(const [id,record] of Object.entries(legacy)) {
     if(pending.some(op=>op.workoutId===id))continue
     if(remote[id]) {
      // A confirmed receipt proves this exact operation was migrated. Any other
      // legacy value is retained for explicit resolution, never timestamp-merged.
      if(record.operationId&&record.operationId===remote[id].operationId) {next={...next,trainingCheckIns:{...next.trainingCheckIns}};delete next.trainingCheckIns[id]}
      else next={...next,checkinMigrationConflicts:{...next.checkinMigrationConflicts,[id]:record},checkinConflicts:{...next.checkinConflicts,[id]:{local:record,remote:remote[id],operationIds:[]}},checkinSyncError:'conflict'}
     } else if(state.workouts?.some(w=>w.id===id)) next=queueCheckin(next,accountId,id,{...record,operationId:record.operationId||crypto.randomUUID()},null,true)
    }
    if(!replace(next))return
    const blocked=new Set(Object.keys(getState().checkinConflicts||{}))
    while(current()&&isOnline()) {
     const op=getState().pendingCheckinOperations?.find(item=>item.accountId===accountId&&!blocked.has(item.workoutId))
     if(!op)break
     if(op.accountId!==accountId)break
     try {
      const ack=await repository.save(op)
      if(!current())return
      const fresh=getState(),queue=(fresh.pendingCheckinOperations||[]).filter(item=>item.operationId!==op.operationId)
      const newer=queue.some(item=>item.workoutId===op.workoutId)
      const legacyCopy={...fresh.trainingCheckIns}
      if(op.import&&JSON.stringify(legacyCopy[op.workoutId])===JSON.stringify(getState().trainingCheckIns?.[op.workoutId])) {
       // Exact legacy content, allowing only the operation id assigned on import.
       const {operationId:_old,...old}=legacyCopy[op.workoutId]||{}, {operationId:_sent,...sent}=op.record
       if(JSON.stringify(old)===JSON.stringify(sent))delete legacyCopy[op.workoutId]
      }
      if(!replace({...fresh,pendingCheckinOperations:queue,trainingCheckIns:legacyCopy,trainingCheckinRecords:{...fresh.trainingCheckinRecords,[op.workoutId]:newer?{...fresh.trainingCheckinRecords[op.workoutId],revision:ack.revision}:{...ack,shares:op.shares??fresh.trainingCheckinRecords?.[op.workoutId]?.shares??[]}}}))return
     } catch(error) {
      if(error.code==='40001'||error.code==='PCK01') {
       // Block only this workout, including its dependent operations. No retry
       // until the owner explicitly chooses a revision in the existing sheet.
       const latestRemote=await repository.load()
       if(!current())return
       const fresh=getState()
       if(!replace({...fresh,checkinSyncError:'conflict',checkinConflicts:{...fresh.checkinConflicts,[op.workoutId]:{remote:latestRemote[op.workoutId]??null,operationIds:(fresh.pendingCheckinOperations||[]).filter(item=>item.accountId===accountId&&item.workoutId===op.workoutId).map(item=>item.operationId)}}}))return
       blocked.add(op.workoutId)
       continue
      }
      if(current())replace({...getState(),checkinSyncError:['PGRST202','42P01','PGRST205'].includes(error.code)?'unavailable':'pending'})
      break
     }
    }
   } catch(error) {
    if(current())replace({...getState(),checkinSyncError:['PGRST202','42P01','PGRST205'].includes(error.code)?'unavailable':'pending'})
   }
  })().finally(()=>{running=null})
  return running
 }
 return {flush,dispose(){disposed=true}}
}

/** Explicit owner decision; never merges private text or restores consent. */
export function resolveCheckinConflict(state,accountId,workoutId,choice) {
 const conflict=state.checkinConflicts?.[workoutId]
 if(!conflict||!['local','remote'].includes(choice))throw new Error('checkin-conflict-unavailable')
 const affected=(state.pendingCheckinOperations||[]).filter(op=>op.accountId===accountId&&op.workoutId===workoutId)
 if(affected.some(op=>!conflict.operationIds.includes(op.operationId)))throw new Error('checkin-conflict-changed')
 const conflicts={...state.checkinConflicts};delete conflicts[workoutId]
 const legacy={...state.trainingCheckIns};delete legacy[workoutId]
 const migration={...state.checkinMigrationConflicts};delete migration[workoutId]
 const records={...state.trainingCheckinRecords}
 if(conflict.remote)records[workoutId]=conflict.remote;else delete records[workoutId]
 const next={...state,trainingCheckIns:legacy,checkinMigrationConflicts:migration,checkinConflicts:conflicts,trainingCheckinRecords:records,pendingCheckinOperations:(state.pendingCheckinOperations||[]).filter(op=>!(op.accountId===accountId&&op.workoutId===workoutId)),checkinSyncError:Object.keys(conflicts).length?'conflict':null}
 if(choice==='remote')return next
 const local=conflict.local??state.trainingCheckinRecords?.[workoutId]
 if(!local)throw new Error('checkin-local-unavailable')
 return queueCheckin(next,accountId,workoutId,{...local,operationId:crypto.randomUUID()},[])
}
