import { expect, it, vi } from 'vitest'
import { createAccountDomainSync } from './account-domain-sync.js'

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

const initial = () => ({
  planMode: 'weekly', week: {}, dayPlan: {}, routines: [], profile: { startWeight: 72 },
  bodyweight: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', d: '2026-10-20', w: 72, t: 1 }],
  bodyMeasurements: [], workouts: [], displayUnit: 'kg', _pendingSync: { body: true },
})

const bodyResponse = weight => ({ weights: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', date: '2026-10-20', weightKg: weight, updatedAt: '2026-10-20T12:00:00Z' }], measurements: [] })

function harness({ online = true, saveBody = vi.fn(async ({ weights }) => bodyResponse(weights[0].weightKg)) } = {}) {
  let state = initial()
  let connected = online
  const statuses = []
  const repository = { saveBody, savePlan: vi.fn(), savePreferences: vi.fn(), deleteCompletedWorkout: vi.fn(async () => true) }
  const sync = createAccountDomainSync({
    repository,
    getState: () => state,
    replaceState: next => { state = next },
    isCurrent: () => true,
    isOnline: () => connected,
    onStatus: status => statuses.push(status),
  })
  return { sync, repository, statuses, state: () => state, setState: next => { state = next }, setOnline: value => { connected = value } }
}

it('sends an online weight immediately and confirms saved only after the database responds', async () => {
  const pending = deferred()
  const h = harness({ saveBody: vi.fn(() => pending.promise) })
  const flush = h.sync.start()
  expect(h.repository.saveBody).toHaveBeenCalledTimes(1)
  expect(h.state()._pendingSync.body).toBe(true)
  expect(h.statuses.at(-1).state).toBe('saving')
  pending.resolve(bodyResponse(72))
  await flush
  expect(h.state()._pendingSync.body).toBe(false)
  expect(h.statuses.at(-1).state).toBe('saved')
})

it('keeps the local pending weight offline and sends it when the connection returns', async () => {
  const h = harness({ online: false })
  await h.sync.start()
  expect(h.repository.saveBody).not.toHaveBeenCalled()
  expect(h.state()._pendingSync.body).toBe(true)
  expect(h.statuses.at(-1).state).toBe('queued')
  h.setOnline(true)
  await h.sync.retry()
  expect(h.repository.saveBody).toHaveBeenCalledTimes(1)
  expect(h.state()._pendingSync.body).toBe(false)
})

it('preserves a failed write and retries it without claiming success', async () => {
  const saveBody = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(bodyResponse(72))
  const h = harness({ saveBody })
  await h.sync.start()
  expect(h.state()._pendingSync.body).toBe(true)
  expect(h.statuses.at(-1).state).toBe('error')
  await h.sync.retry()
  expect(saveBody).toHaveBeenCalledTimes(2)
  expect(h.state()._pendingSync.body).toBe(false)
})

it('automatically retries a transient server failure while online', async () => {
  vi.useFakeTimers()
  try {
    const failure = Object.assign(new Error('temporary outage'), { kind: 'request-failed', retryable: true })
    const saveBody = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(bodyResponse(72))
    const h = harness({ saveBody })
    await h.sync.start()
    expect(h.state()._pendingSync.body).toBe(true)
    await vi.advanceTimersByTimeAsync(2000)
    expect(saveBody).toHaveBeenCalledTimes(2)
    expect(h.state()._pendingSync.body).toBe(false)
  } finally { vi.useRealTimers() }
})

it('serializes body replacements and sends a newer weight after an in-flight write', async () => {
  const first = deferred()
  const saveBody = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(async ({ weights }) => bodyResponse(weights[0].weightKg))
  const h = harness({ saveBody })
  const flush = h.sync.start()
  h.setState({ ...h.state(), bodyweight: [{ ...h.state().bodyweight[0], w: 73 }] })
  const later = h.sync.changed()
  expect(saveBody).toHaveBeenCalledTimes(1)
  first.resolve(bodyResponse(72))
  await Promise.all([flush, later])
  expect(saveBody).toHaveBeenCalledTimes(2)
  expect(h.state().bodyweight[0].w).toBe(73)
  expect(h.state()._pendingSync.body).toBe(false)
})

it('does not replace an unsent local weight with a remote refresh', async () => {
  const h = harness({ online: false })
  await h.sync.start()
  h.sync.acceptRemote('body', bodyResponse(70))
  expect(h.state().bodyweight[0].w).toBe(72)
  expect(h.state()._pendingSync.body).toBe(true)
})

it('recovers a legacy local weigh-in when the account has no weight in the database', async () => {
  const h = harness({ online: false })
  h.setState({ ...h.state(), _pendingSync: {} })
  h.sync.acceptRemote('body', { weights: [], measurements: [] })
  expect(h.state().bodyweight[0].w).toBe(72)
  expect(h.state()._pendingSync.body).toBe(true)
})

it('keeps a failed domain visible when another domain saves successfully', async () => {
  const preference = deferred()
  const h = harness({ saveBody: vi.fn(async () => { throw new Error('body rejected') }) })
  h.setState({ ...h.state(), _pendingSync: { body: true, preferences: true } })
  h.repository.savePreferences.mockReturnValue(preference.promise)
  const flush = h.sync.start()
  await Promise.resolve()
  preference.resolve({ revision: 1, values: { profile: { startWeight: 72 } }, displayUnit: 'kg', massUnit: 'kg' })
  await flush
  expect(h.state()._pendingSync.body).toBe(true)
  expect(h.state()._pendingSync.preferences).toBe(false)
  expect(h.statuses.at(-1).state).toBe('error')
})

it('does not apply an old account response after switching accounts', async () => {
  const response = deferred()
  let current = true
  let state = initial()
  const sync = createAccountDomainSync({
    repository: { saveBody: () => response.promise },
    getState: () => state,
    replaceState: next => { state = next },
    isCurrent: () => current,
    isOnline: () => true,
  })
  const flush = sync.start()
  current = false
  response.resolve(bodyResponse(72))
  await flush
  expect(state._pendingSync.body).toBe(true)
})

it('hides an offline deleted workout during history refresh and deletes it on reconnect', async () => {
  const h = harness({ online: false })
  h.setState({ ...h.state(), _pendingSync: {}, _pendingWorkoutDeletes: ['session-1'] })
  await h.sync.start()
  h.sync.acceptRemote('history', [
    { workout: { id: 'session-1', d: '2026-10-19', entries: [] } },
    { workout: { id: 'session-2', d: '2026-10-20', entries: [] } },
  ])
  expect(h.state().workouts.map(workout => workout.id)).toEqual(['session-2'])
  expect(h.statuses.at(-1).state).toBe('queued')
  h.setOnline(true)
  await h.sync.retry()
  expect(h.repository.deleteCompletedWorkout).toHaveBeenCalledWith({ sessionId: 'session-1' })
  expect(h.state()._pendingWorkoutDeletes).toEqual([])
})

it('keeps a workout deletion queued after a failed request', async () => {
  const h = harness({ saveBody: vi.fn() })
  h.setState({ ...h.state(), _pendingSync: {}, _pendingWorkoutDeletes: ['session-1'] })
  h.repository.deleteCompletedWorkout.mockRejectedValueOnce(new Error('server error'))
  await h.sync.start()
  expect(h.state()._pendingWorkoutDeletes).toEqual(['session-1'])
  expect(h.statuses.at(-1).state).toBe('error')
})

it('does not resurrect a deleted workout from a stale in-flight history read', async () => {
  const h = harness()
  h.setState({ ...h.state(), _pendingSync: {}, _pendingWorkoutDeletes: ['session-1'] })
  await h.sync.start()
  expect(h.state()._pendingWorkoutDeletes).toEqual([])
  h.sync.acceptRemote('history', [{ workout: { id: 'session-1', d: '2026-10-19', entries: [] } }])
  expect(h.state().workouts).toEqual([])
})
it('keeps personal edits pending with a durable conflict when another device selects a different plan',async()=>{
 const h=harness();h.setState({...h.state(),bodyweight:[],activeLibraryId:'old',routines:[{id:'personal',name:'Unsent personal edit',ex:[]}],_pendingSync:{plan:true}})
 h.repository.savePlan.mockRejectedValue({kind:'selection-conflict'})
 h.repository.saveDetachedPlan=vi.fn().mockResolvedValue('backup')
 h.repository.loadPlan=vi.fn().mockResolvedValue({routines:[],schedule:{revision:5,mode:'weekly',values:{libraryId:'new'}}})
 await h.sync.start()
 expect(h.state()).toMatchObject({activeLibraryId:'old',routines:[{name:'Unsent personal edit'}],_pendingSync:{plan:true},_syncConflicts:{plan:{local:{routines:[{title:'Unsent personal edit'}]},remote:{schedule:{libraryId:'new'}}}}})
 expect(h.statuses.at(-1)).toMatchObject({state:'error',error:'sync-conflict'})
 h.sync.acceptRemote('plan',await h.repository.loadPlan())
 expect(h.state().routines[0].name).toBe('Unsent personal edit')
 expect(h.state()._pendingSync.plan).toBe(true)
 expect(h.repository.saveDetachedPlan).not.toHaveBeenCalled()
})

it('preserves professional assignment metadata when synchronizing personal edits', async () => {
  const h = harness()
  const assignment = { assignmentId: 'assignment', versionId: 'version' }
  h.setState({ ...initial(), assignedProgram: assignment, activeLibraryId: 'library', _pendingSync: { plan: true } })
  h.repository.savePlan.mockImplementation(async input => ({ routines: [], schedule: { revision: 2, mode: input.mode, values: input.schedule } }))
  await h.sync.start()
  expect(h.repository.savePlan.mock.calls[0][0].schedule.assignedProgram).toEqual(assignment)
  expect(h.state().assignedProgram).toEqual(assignment)
  expect(h.state()._pendingSync.plan).toBe(false)
})

function planPair() {
 let revision = 1
 let remote = { schedule:{revision,mode:'weekly',values:{week:{},dayPlan:{}}}, routines:[{id:'a',title:'A',prescription:{ex:[]}},{id:'b',title:'B',prescription:{ex:[]}}] }
 const repository = {
  loadPlan:vi.fn(async () => structuredClone(remote)),
  savePlan:vi.fn(async input => {
   if(input.expectedRevision !== revision) throw Object.assign(new Error('revision'),{kind:'revision-conflict',retryable:true})
   remote={schedule:{revision:++revision,mode:input.mode,values:input.schedule},routines:input.routines}
   return structuredClone(remote)
  }),
 }
 const device = () => {
  let state = {...initial(),bodyweight:[],_pendingSync:{}}
  let online = true
  const sync = createAccountDomainSync({repository,getState:()=>state,replaceState:next=>{state=next},isCurrent:()=>true,isOnline:()=>online})
  sync.acceptRemote('plan',structuredClone(remote))
  return {sync,state:()=>state,edit:(index,name)=>{state={...state,routines:state.routines.map((r,i)=>i===index?{...r,name}:r),_pendingSync:{plan:true}}},online:value=>{online=value}}
 }
 return {device,repository,remote:()=>remote}
}
it('preserves edits from two devices to different workouts through one conflict retry',async()=>{
 const h=planPair(),a=h.device(),b=h.device()
 a.edit(0,'AA');b.edit(1,'BB')
 await a.sync.start();await b.sync.start()
 expect(h.remote().routines.map(r=>r.title)).toEqual(['AA','BB'])
 expect(h.repository.loadPlan).toHaveBeenCalledTimes(1)
 expect(h.repository.savePlan).toHaveBeenCalledTimes(3)
 expect(b.state()._pendingSync.plan).toBe(false)
})
it('preserves both versions on incompatible edits, including remote refresh while pending',async()=>{
 const h=planPair(),a=h.device(),b=h.device()
 a.edit(0,'AA');b.edit(0,'BB');await a.sync.start()
 b.sync.acceptRemote('plan',structuredClone(h.remote()))
 await b.sync.start()
 expect(h.remote().routines[0].title).toBe('AA')
 expect(b.state().routines[0].name).toBe('BB')
 expect(b.state()._syncConflicts.plan.remote.routines[0].title).toBe('AA')
 expect(b.sync.status().error).toBe('sync-conflict')
 expect(h.repository.savePlan).toHaveBeenCalledTimes(2)
})
it('reconnects offline edits without discarding another device changes',async()=>{
 const h=planPair(),a=h.device(),b=h.device()
 b.online(false);b.edit(1,'BB');await b.sync.start()
 a.edit(0,'AA');await a.sync.start()
 b.online(true);await b.sync.retry()
 expect(h.remote().routines.map(r=>r.title)).toEqual(['AA','BB'])
})
it('stops after the single revision retry when a third writer wins again',async()=>{
 const h=planPair(),a=h.device(),b=h.device()
 a.edit(0,'AA');await a.sync.start();b.edit(1,'BB')
 h.repository.savePlan.mockRejectedValue(Object.assign(new Error('busy'),{kind:'revision-conflict',retryable:true}))
 await b.sync.start()
 expect(h.repository.savePlan).toHaveBeenCalledTimes(3)
 expect(b.sync.status().error).toBe('sync-conflict')
 expect(b.state()._pendingSync.plan).toBe(true)
})

it('retains merged remote changes when local edits occur during the retry response',async()=>{
 const h=planPair(),a=h.device(),b=h.device()
 a.edit(0,'AA');await a.sync.start();b.edit(1,'BB')
 const original=h.repository.savePlan.getMockImplementation(), pending=deferred()
 h.repository.savePlan.mockImplementationOnce(original).mockImplementationOnce(async input=>{await pending.promise;return original(input)})
 const saving=b.sync.start()
 for(let i=0;i<20 && h.repository.savePlan.mock.calls.length<3;i++)await Promise.resolve()
 b.edit(1,'BBB');pending.resolve();await saving
 expect(h.remote().routines.map(r=>r.title)).toEqual(['AA','BBB'])
 expect(b.state().routines.map(r=>r.name)).toEqual(['AA','BBB'])
})
it('limits automatic transient retries and preserves the pending journal',async()=>{
 vi.useFakeTimers()
 try {
  const saveBody=vi.fn(async()=>{throw Object.assign(new Error('offline'),{kind:'request-failed',retryable:true})})
  const h=harness({saveBody});await h.sync.start();await vi.runAllTimersAsync()
  expect(saveBody).toHaveBeenCalledTimes(6);expect(h.state()._pendingSync.body).toBe(true)
  h.sync.dispose()
 }finally{vi.useRealTimers()}
})

it('holds incompatible conflicts across unrelated changes and reloads until explicitly retried',async()=>{
 const h=planPair(),a=h.device(),b=h.device()
 a.edit(0,'AA');b.edit(0,'BB');await a.sync.start();await b.sync.start()
 const saves=h.repository.savePlan.mock.calls.length,reads=h.repository.loadPlan.mock.calls.length
 b.edit(1,'Unrelated');await b.sync.changed()
 const restored=createAccountDomainSync({repository:h.repository,getState:b.state,replaceState:()=>{},isOnline:()=>true,isCurrent:()=>true})
 await restored.start()
 expect(restored.status().error).toBe('sync-conflict')
 expect(h.repository.savePlan).toHaveBeenCalledTimes(saves)
 expect(h.repository.loadPlan).toHaveBeenCalledTimes(reads)
 b.edit(0,'AA');await b.sync.retry()
 expect(h.remote().routines.map(row=>row.title)).toEqual(['AA','Unrelated'])
 expect(b.state()._syncConflicts?.plan).toBeUndefined()
})

function bodyPair() {
  let remote = { revision: 1, weights: [], measurements: [] }
  const repository = {
    loadBody: vi.fn(async () => structuredClone(remote)),
    saveBody: vi.fn(async ({ expectedRevision, ...input }) => {
      if (expectedRevision !== remote.revision) throw Object.assign(new Error('body revision'), { kind: 'revision-conflict', retryable: true })
      remote = { ...structuredClone(input), revision: remote.revision + 1 }
      return structuredClone(remote)
    }),
  }
  const device = () => {
    let state = { ...initial(), bodyweight: [], _pendingSync: {} }
    let online = true
    const sync = createAccountDomainSync({ repository, getState: () => state, replaceState: next => { state = next }, isCurrent: () => true, isOnline: () => online })
    sync.acceptRemote('body', structuredClone(remote))
    return { sync, state: () => state, online: value => { online = value }, edit: patch => { state = { ...state, ...patch, _pendingSync: { body: true } } } }
  }
  return { repository, device, remote: () => structuredClone(remote) }
}
const weightRow = (id, w = 72) => ({ id: `${id.repeat(8)}-${id.repeat(4)}-4${id.repeat(3)}-8${id.repeat(3)}-${id.repeat(12)}`, d: '2026-10-20', w, t: 1 })
const measureRow = (id, values) => ({ id: weightRow(id).id, date: '2026-10-20', values, createdAt: 1, updatedAt: 1 })

it('merges independent offline body additions from two devices with revision CAS', async () => {
  const h = bodyPair(), a = h.device(), b = h.device()
  b.online(false)
  a.edit({ bodyweight: [weightRow('a')], bodyMeasurements: [measureRow('b', { chest: 100 })] })
  b.edit({ bodyweight: [weightRow('c', 80)], bodyMeasurements: [measureRow('d', { waist: 88 })] })
  await b.sync.start(); await a.sync.start()
  expect(b.state()._pendingSync.body).toBe(true)
  b.online(true); await b.sync.retry()
  expect(h.remote().weights.map(row => row.id)).toEqual([weightRow('a').id, weightRow('c').id])
  expect(h.remote().measurements.map(row => row.valuesCm)).toEqual([{ chest: 100 }, { waist: 88 }])
  expect(h.repository.saveBody.mock.calls.map(([input]) => input.expectedRevision)).toEqual([1, 1, 2])
  expect(b.state().bodyServerRevision).toBe(3)
  expect(b.state()._pendingSync.body).toBe(false)
  expect(b.state()._syncBases.body.weights).toEqual(h.remote().weights)
})

it('retains the selection conflict and current edits when loading the other selection fails', async () => {
 const h=harness();h.setState({...h.state(),bodyweight:[],activeLibraryId:'old',routines:[{id:'personal',name:'Offline edit',ex:[]}],_pendingSync:{plan:true}})
 h.repository.savePlan.mockRejectedValue({kind:'selection-conflict'})
 h.repository.loadPlan=vi.fn().mockRejectedValue(new Error('offline'))
 await h.sync.start()
 expect(h.state()).toMatchObject({activeLibraryId:'old',routines:[{name:'Offline edit'}],_pendingSync:{plan:true},_syncConflicts:{plan:{remote:null,local:{routines:[{title:'Offline edit'}]}}}})
 expect(h.statuses.at(-1)).toMatchObject({state:'error',error:'sync-conflict'})
})

it('does not replace another account while a selection conflict read is in flight', async () => {
 const response=deferred();let current=true
 let state={...initial(),bodyweight:[],activeLibraryId:'old',routines:[{id:'personal',name:'First edit',ex:[]}],_pendingSync:{plan:true}}
 const repository={savePlan:vi.fn().mockRejectedValue({kind:'selection-conflict'}),loadPlan:vi.fn(()=>response.promise)}
 const sync=createAccountDomainSync({repository,getState:()=>state,replaceState:next=>{state=next},isCurrent:()=>current,isOnline:()=>true})
 const flush=sync.start()
 await vi.waitFor(()=>expect(repository.loadPlan).toHaveBeenCalledTimes(1))
 expect(repository.loadPlan).toHaveBeenCalledTimes(1)
 current=false
 state={...initial(),routines:[{id:'other',name:'Other account',ex:[]}],_pendingSync:{}}
 const other=state
 response.resolve({routines:[],schedule:{revision:5,mode:'weekly',values:{libraryId:'new'}}})
 await flush
 expect(state).toBe(other)
})

it('keeps an edit made during a selection conflict read in both the live journal and conflict evidence', async () => {
 const h=harness(),response=deferred()
 h.setState({...h.state(),bodyweight:[],activeLibraryId:'old',routines:[{id:'personal',name:'First edit',ex:[]}],_pendingSync:{plan:true}})
 h.repository.savePlan.mockRejectedValue({kind:'selection-conflict'})
 h.repository.loadPlan=vi.fn(()=>response.promise)
 const flush=h.sync.start()
 await vi.waitFor(()=>expect(h.repository.loadPlan).toHaveBeenCalledTimes(1))
 h.setState({...h.state(),routines:[{id:'personal',name:'Newer edit',ex:[]}]})
 response.resolve({routines:[],schedule:{revision:5,mode:'weekly',values:{libraryId:'new'}}})
 await flush
 expect(h.state()).toMatchObject({activeLibraryId:'old',routines:[{name:'Newer edit'}],_pendingSync:{plan:true},_syncConflicts:{plan:{local:{routines:[{title:'Newer edit'}]}}}})
})

it('keeps incompatible same-ID body edits durable without overwriting either device', async () => {
  const h = bodyPair(), seed = h.device()
  seed.edit({ bodyweight: [weightRow('a')] }); await seed.sync.start()
  const a = h.device(), b = h.device()
  a.edit({ bodyweight: [weightRow('a', 73)] }); b.edit({ bodyweight: [weightRow('a', 74)] })
  await a.sync.start(); b.sync.acceptRemote('body', h.remote()); await b.sync.start()
  expect(h.remote().weights[0].weightKg).toBe(73)
  expect(b.state().bodyweight[0].w).toBe(74)
  expect(b.state()._syncConflicts.body).toMatchObject({ local: { weights: [{ weightKg: 74 }] }, remote: { weights: [{ weightKg: 73 }] } })
  const count = h.repository.saveBody.mock.calls.length
  const restored = createAccountDomainSync({ repository: h.repository, getState: b.state, replaceState: () => {}, isCurrent: () => true, isOnline: () => true })
  await restored.start(); await restored.changed()
  expect(restored.status().error).toBe('sync-conflict')
  expect(h.repository.saveBody).toHaveBeenCalledTimes(count)
})

it('preserves stable body IDs and pending edits after a second writer wins the single retry', async () => {
  const h = bodyPair(), a = h.device(), b = h.device()
  a.edit({ bodyweight: [weightRow('a')] }); await a.sync.start()
  b.edit({ bodyMeasurements: [measureRow('b', { chest: 100 })] })
  h.repository.saveBody.mockRejectedValue(Object.assign(new Error('busy'), { kind: 'revision-conflict', retryable: true }))
  await b.sync.start()
  expect(h.repository.saveBody).toHaveBeenCalledTimes(3)
  expect(h.repository.saveBody.mock.calls.slice(1).map(([input]) => input.measurements[0].id)).toEqual([weightRow('b').id, weightRow('b').id])
  expect(b.state()._pendingSync.body).toBe(true)
  expect(b.state()._syncConflicts.body.remote.weights[0].id).toBe(weightRow('a').id)
})

it('keeps same-ID measurement conflicts pending while preserving the committed server values', async () => {
 const h=bodyPair(),seed=h.device()
 seed.edit({bodyMeasurements:[measureRow('a',{chest:100})]});await seed.sync.start()
 const a=h.device(),b=h.device()
 a.edit({bodyMeasurements:[measureRow('a',{chest:101})]})
 b.edit({bodyMeasurements:[measureRow('a',{chest:102})]})
 await a.sync.start();await b.sync.start()
 expect(h.remote().measurements[0].valuesCm.chest).toBe(101)
 expect(b.state().bodyMeasurements[0].values.chest).toBe(102)
 expect(b.state()._syncConflicts.body.remote.measurements[0].valuesCm.chest).toBe(101)
 expect(b.state()._pendingSync.body).toBe(true)
 expect(b.sync.status().error).toBe('sync-conflict')
})

it('retries a body transport failure with unchanged IDs and expected revision', async () => {
 const h=bodyPair(),a=h.device()
 a.edit({bodyweight:[weightRow('a')],bodyMeasurements:[measureRow('b',{waist:88})]})
 h.repository.saveBody.mockRejectedValueOnce(Object.assign(new Error('network'),{kind:'offline',retryable:false}))
 await a.sync.start();await a.sync.retry()
 expect(h.repository.saveBody.mock.calls[1][0]).toEqual(h.repository.saveBody.mock.calls[0][0])
 expect(a.state().bodyweight[0].id).toBe(weightRow('a').id)
 expect(a.state().bodyMeasurements[0].id).toBe(weightRow('b').id)
 expect(a.state()._pendingSync.body).toBe(false)
})
