import { expect, it } from 'vitest'
import { migrateLocalState } from './local-state-migrations.js'
import { readScopedState, writeScopedState } from './account-cache.js'
import { ANONYMOUS_SCOPE } from './local-state-scope.js'
const storage = () => { const rows = new Map(); return { getItem:key=>rows.get(key)||null, setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key),rows } }
it.each([undefined,1,2])('preserves version %s, kg/lb, history and active workout idempotently',version=>{
 const old={stateSchemaVersion:version,unit:'lb',displayUnit:'lb',routines:[{id:'r',ex:[]}],workouts:[{id:'w',entries:[]}],active:{id:'a',entries:[],durationMs:9000},bodyweight:[{d:'2026-10-01',w:72}],exWeights:{x:{w:60}}}
 const migrated=migrateLocalState(old)
 expect(migrated).toMatchObject({...old,stateSchemaVersion:2,massUnit:'kg'})
 expect(migrateLocalState(migrated)).toEqual(migrated)
})
it('migrates incomplete state offline and writes the current version on read',()=>{
 const local=storage();local.setItem('gym_state_v1',JSON.stringify({stateSchemaVersion:1,unit:'lb',sound:false}))
 expect(readScopedState(ANONYMOUS_SCOPE,local,{}).state).toMatchObject({stateSchemaVersion:2,displayUnit:'lb',sound:false,routines:[],workouts:[]})
 expect(JSON.parse(local.getItem('gym_state_v1')).stateSchemaVersion).toBe(2)
})
it('preserves a credential-free recovery copy before rejecting structurally corrupt or future data',()=>{
 const local=storage();local.setItem('gym_state_v1',JSON.stringify({stateSchemaVersion:99,routines:[],workouts:[],profile:{name:'Ana',secret:'credential'},extra:{value:'credential'}}))
 expect(readScopedState(ANONYMOUS_SCOPE,local,{}).status).toBe('invalid')
 expect(local.getItem('gym_state_v1:recovery')).toContain('Ana')
 expect(local.getItem('gym_state_v1:recovery')).not.toContain('credential')
})
it('round-trips the ongoing workout and functional weights without auth containers',()=>{
 const local=storage(),state={stateSchemaVersion:2,massUnit:'kg',displayUnit:'kg',routines:[],workouts:[],active:{id:'a',entries:[{id:'x',sg:'a',target:{bodyweight:true,inc:1},sets:[{w:20,r:10,done:true,phase:'warmup'}]}],bw:72,cur:0,durationMs:9000},exWeights:{x:{w:60}},secret:{value:'credential'}}
 writeScopedState(ANONYMOUS_SCOPE,state,local)
 const read=readScopedState(ANONYMOUS_SCOPE,local,{})
 expect(read.state.active).toEqual(state.active)
 expect(read.state.exWeights).toEqual(state.exWeights)
 expect(JSON.stringify(read)).not.toContain('credential')
})
it('keeps valid data readable when storage quota prevents rewriting',()=>{
 const local=storage();local.setItem('gym_state_v1',JSON.stringify({routines:[],workouts:[],sound:false}));local.setItem=()=>{throw new Error('quota')}
 expect(readScopedState(ANONYMOUS_SCOPE,local,{})).toMatchObject({status:'error',state:{sound:false}})
})

it('preserves custom descriptions and active recovery without arbitrary credentials',async()=>{
 const {projectPersistedState,projectSessionRecovery}=await import('./persisted-state.js')
 expect(projectPersistedState({customEx:[{id:'custom-1',desc:'Minha descrição',authorization:'secret'}]})).toEqual({customEx:[{id:'custom-1',desc:'Minha descrição'}]})
 const active={id:'w',entries:[{id:'e',sets:[{w:20,r:8,done:true}]}]}
 expect(projectSessionRecovery({pendingOperations:[{operationId:'o',kind:'set_upserted',payload:{active,session:{access_token:'secret'}}}]}).pendingOperations[0].payload).toEqual({active})
})

it('preserves completed volume and dated personal records across an offline rewrite',()=>{
 const local=storage(),state={stateSchemaVersion:1,routines:[],workouts:[{id:'w',d:'2026-11-01',vol:1200,entries:[]}],exWeights:{'0025':{w:60,d:'2026-11-01'}}}
 local.setItem('gym_state_v1',JSON.stringify(state))
 const result=readScopedState(ANONYMOUS_SCOPE,local,{})
 expect(result.state.workouts[0].vol).toBe(1200)
 expect(result.state.exWeights['0025']).toEqual(state.exWeights['0025'])
})

it('keeps offline professional completion details and session bodyweight',async()=>{
 const {projectPersistedState,projectSessionRecovery}=await import('./persisted-state.js')
 const entries=[{id:'0025',sets:[{w:20,r:10,done:true}]}]
 expect(projectPersistedState({pendingProfessionalEvents:[{id:'event',payload:{entries,workoutName:'A',start:1,end:2}}]}).pendingProfessionalEvents[0].payload).toEqual({entries,workoutName:'A',start:1,end:2})
 expect(projectSessionRecovery({session:{prescriptionSnapshot:{bodyweightKg:75,exercises:[]}}}).session.prescriptionSnapshot.bodyweightKg).toBe(75)
})

it('keeps progression prescriptions, routine rules and completion operation semantics',async()=>{
 const {projectPersistedState,projectSessionRecovery}=await import('./persisted-state.js')
 const plan={policy:'double',kind:'maintain',weight:30,reps:10,why:['Keep current load',30]}
 const entries=[{id:'0025',sets:[],plan}]
 expect(projectPersistedState({routines:[{id:'r',prog:'double',ex:[]}],active:{id:'w',entries}})).toMatchObject({routines:[{prog:'double'}],active:{entries:[{plan}]}})
 expect(projectSessionRecovery({pendingOperations:[{payload:{entries,endedEarly:true,workoutId:'w'}}]}).pendingOperations[0].payload).toEqual({entries,endedEarly:true,workoutId:'w'})
})

it('round-trips stable legacy body IDs, merge bases and unresolved conflicts through account storage', () => {
 const local=storage()
 const wire={weights:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',date:'2026-10-20',weightKg:72}],measurements:[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',date:'2026-10-20',valuesCm:{chest:100},note:'morning'}]}
 const state=migrateLocalState({routines:[],workouts:[],bodyweight:[{d:'2026-10-20',w:72}],bodyMeasurements:[{date:'2026-10-20',values:{chest:100}}],bodyServerRevision:7,_pendingSync:{body:true},_syncBases:{body:wire},_syncConflicts:{body:{base:wire,local:wire,remote:{...wire,weights:[]},path:'weights'}}})
 writeScopedState({kind:'account',userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},state,local)
 const restored=readScopedState({kind:'account',userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},local,{}).state
 expect(restored.bodyweight[0].id).toMatch(/^[0-9a-f-]{36}$/i)
 expect(restored.bodyMeasurements[0].id).toMatch(/^[0-9a-f-]{36}$/i)
 expect(restored.bodyServerRevision).toBe(7)
 expect(restored._pendingSync.body).toBe(true)
 expect(restored._syncBases.body).toEqual(wire)
 expect(restored._syncConflicts.body).toEqual(state._syncConflicts.body)
 expect(migrateLocalState(restored).bodyweight[0].id).toBe(restored.bodyweight[0].id)
 expect(migrateLocalState(restored).bodyMeasurements[0].id).toBe(restored.bodyMeasurements[0].id)
})
