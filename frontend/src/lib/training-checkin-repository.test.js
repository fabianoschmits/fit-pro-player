import { it, expect } from 'vitest'
import { createTrainingCheckinRepository, createTrainingCheckinSync, queueCheckin } from './training-checkin-repository.js'
import { projectPersistedState } from './persisted-state.js'
import { preferenceValues } from './domain-sync-state.js'
import { buildWeeklyCheckinSummary } from './training-checkin.js'
const answer={version:1,status:'answered',reasons:['time_constraint'],note:'private',operationId:'operation'}
it('retains existing sensitive consent when a different professional grant is edited',async()=>{
 const client={from:table=>{
  const query={select:()=>query,order:()=>query,range:async()=>({data:table==='training_checkins'?[{id:'id',workout_id:'w',version:1,status:'answered',reasons:['pain_or_discomfort'],note:'private',revision:2}]:[{checkin_id:'id',relationship_id:'active',shared_reasons:['pain_or_discomfort'],revoked_at:null},{checkin_id:'id',relationship_id:'revoked',shared_reasons:['pain_or_discomfort'],revoked_at:'2026-11-24'}],error:null})}
  return query
 }}
 const records=await createTrainingCheckinRepository(client).load()
 expect(records.w.shares).toEqual([{relationshipId:'active',reasons:['pain_or_discomfort'],sensitiveConsent:true}])
})
it('migrates once, cleans only acknowledged legacy and preserves weekly context',async()=>{
 let state={workouts:[{id:'w',entries:[]}],trainingCheckIns:{w:answer},theme:'dark'},remote={},writes=0
 const repository={load:async()=>remote,save:async op=>{writes++;remote={...remote,[op.workoutId]:{...op.record,revision:1}};return remote[op.workoutId]}}
 const sync=createTrainingCheckinSync({repository,accountId:'owner',getState:()=>state,replaceState:s=>{state=s},isCurrent:()=>true,isOnline:()=>true})
 await sync.flush();await sync.flush()
 expect(writes).toBe(1);expect(state.trainingCheckIns).toEqual({});expect(state.theme).toBe('dark')
 expect(buildWeeklyCheckinSummary([{id:'w',checkIn:state.trainingCheckinRecords.w}]).answeredWorkouts).toBe(1)
})
it('keeps dedicated tombstone and unresolved legacy without resurrection',async()=>{
 const removed=queueCheckin({trainingCheckinRecords:{w:{...answer,revision:2,shares:[{relationshipId:'rel',reasons:['time_constraint']}]}}},'owner','w',{version:1,status:'removed',operationId:'remove'},[{relationshipId:'rel',reasons:['time_constraint']}])
 expect(removed.pendingCheckinOperations[0].shares).toEqual([])
 let state={workouts:[{id:'w',entries:[]}],trainingCheckIns:{w:answer}}
 const sync=createTrainingCheckinSync({repository:{load:async()=>({w:{version:1,status:'removed',revision:3,operationId:'new'}}),save:async()=>{throw Error('must not overwrite')}},accountId:'owner',getState:()=>state,replaceState:s=>{state=s},isCurrent:()=>true,isOnline:()=>true})
 await sync.flush()
 expect(state.trainingCheckinRecords.w.status).toBe('removed');expect(state.checkinMigrationConflicts.w).toEqual(answer)
})
it('persists an offline individual journal outside preferences and drains once',async()=>{
 let online=false,writes=0,state=queueCheckin({workouts:[{id:'w',entries:[]}]},'owner','w',answer,[])
 state=projectPersistedState(state)
 expect(preferenceValues(state).pendingCheckinOperations).toBeUndefined()
 const sync=createTrainingCheckinSync({repository:{load:async()=>({}),save:async op=>{writes++;return {...op.record,revision:1}}},accountId:'owner',getState:()=>state,replaceState:s=>{state=s},isCurrent:()=>true,isOnline:()=>online})
 await sync.flush();expect(writes).toBe(0);expect(state.pendingCheckinOperations).toHaveLength(1)
 online=true;await sync.flush();expect(writes).toBe(1);expect(state.pendingCheckinOperations).toHaveLength(0);expect(state.workouts).toHaveLength(1)
})
it('preserves revision conflicts and never sends the previous account queue',async()=>{
 let state=queueCheckin({workouts:[{id:'w',entries:[]}]},'owner','w',answer),writes=0
 const repository={load:async()=>({}),save:async()=>{writes++;throw {code:'40001'}}}
 const sync=createTrainingCheckinSync({repository,accountId:'owner',getState:()=>state,replaceState:s=>{state=s},isCurrent:()=>true,isOnline:()=>true})
 await sync.flush();expect(state.checkinSyncError).toBe('conflict');expect(state.pendingCheckinOperations).toHaveLength(1)
 sync.dispose();await sync.flush();expect(writes).toBe(1)
})
