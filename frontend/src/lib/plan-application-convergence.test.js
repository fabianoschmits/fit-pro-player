import { expect, it, vi } from 'vitest'
import { createAccountDomainSync } from './account-domain-sync.js'
import { applyDomainState } from './domain-state.js'

const plan = (id, revision) => ({
 routines: [{ id: 'personal', title: 'Current personal', prescription: { ex: [] } }, ...(id === 'professional' ? [{ id: 'assigned', title: 'Received workout', prescription: { assigned: true, programVersionId: 'v2', ex: [{ id: '0043', sets: 3, reps: 10 }] } }] : [])],
 schedule: { revision, mode: id === 'personal' ? 'daily' : 'weekly', values: { libraryId: id, libraryTitle: id, week: id === 'personal' ? { 2: 'personal' } : { 1: 'assigned' }, dayPlan: id === 'personal' ? { '2026-11-02': 'rest' } : {}, ...(id === 'professional' ? { assignedProgram: { versionId: 'v2', assignmentId: 'delivery' } } : {}) } },
})

// One canonical execution workspace shared by clients. Applying commits before transport
// can fail; loading reads the committed result without issuing another application.
function backend(initial) {
 let canonical = structuredClone(initial)
 return {
  loadPlan: vi.fn(async () => structuredClone(canonical)),
  savePlan: vi.fn(),
  applyLibraryPlan: vi.fn(async (id, expectedRevision, loseResponse = false) => {
   if (expectedRevision !== canonical.schedule.revision) throw Object.assign(new Error('plan revision conflict'), { code: '40001' })
   canonical = plan(id, expectedRevision + 1)
   if (loseResponse) throw new Error('response lost after commit')
   return structuredClone(canonical)
  }),
  snapshot: () => structuredClone(canonical),
 }
}
function session(repository, initial) {
 let state = applyDomainState({ _pendingSync: {}, profile: {} }, 'plan', initial)
 let current = true
 const sync = createAccountDomainSync({ repository, getState: () => state, replaceState: next => { state = next }, isCurrent: () => current, isOnline: () => true })
 return { sync, state: () => state, edit: next => { state = next }, leaveAccount: () => { current = false } }
}

it.each([['personal', 'professional'], ['professional', 'personal']])('converges %s to %s after the application commits but its response is lost', async (from, target) => {
 const initial = plan(from, 7), repository = backend(initial), client = session(repository, initial)
 await client.sync.start()
 await expect(repository.applyLibraryPlan(target, 7, true)).rejects.toThrow('response lost')
 expect(client.state().activeLibraryId).toBe(from)
 client.sync.acceptRemote('plan', await repository.loadPlan())
 expect(client.state()).toMatchObject({ activeLibraryId: target, planServerRevision: 8, assignedProgram: target === 'personal' ? null : { versionId: 'v2' }, week: target === 'personal' ? { 2: 'personal' } : { 1: 'assigned' } })
 await client.sync.changed(); await client.sync.retry()
 expect(repository.applyLibraryPlan).toHaveBeenCalledTimes(1)
 expect(repository.savePlan).not.toHaveBeenCalled()
 expect(repository.snapshot().schedule.revision).toBe(8)
})

it('ignores an older execution response arriving after the confirmed new selection', async () => {
 const old = plan('personal', 7), repository = backend(old), client = session(repository, old)
 await repository.applyLibraryPlan('professional', 7)
 client.sync.acceptRemote('plan', await repository.loadPlan())
 client.sync.acceptRemote('plan', old)
 expect(client.state()).toMatchObject({ activeLibraryId: 'professional', planServerRevision: 8, assignedProgram: { versionId: 'v2' }, week: { 1: 'assigned' } })
 expect(client.sync.revision('plan')).toBe(8)
 expect(repository.applyLibraryPlan).toHaveBeenCalledTimes(1)
 expect(repository.savePlan).not.toHaveBeenCalled()
})

it('preserves unsent local edits when refresh finds a newer active plan', async () => {
 const initial = plan('personal', 7), repository = backend(initial), client = session(repository, initial)
 client.edit({ ...client.state(), routines: [{ ...client.state().routines[0], name: 'Unsent edit' }], _pendingSync: { plan: true } })
 const pending = client.state()
 await repository.applyLibraryPlan('professional', 7)
 client.sync.acceptRemote('plan', await repository.loadPlan())
 expect(client.state()).toBe(pending)
 expect(client.state()).toMatchObject({ activeLibraryId: 'personal', planServerRevision: 7, routines: [{ name: 'Unsent edit' }], _pendingSync: { plan: true } })
 expect(repository.savePlan).not.toHaveBeenCalled()
})

it('discards a refresh completed after leaving the account scope', async () => {
 const initial = plan('personal', 7), repository = backend(initial), client = session(repository, initial)
 await repository.applyLibraryPlan('professional', 7)
 const lateResponse = await repository.loadPlan(), before = client.state()
 client.leaveAccount(); client.sync.acceptRemote('plan', lateResponse)
 await client.sync.start(); await client.sync.retry()
 expect(client.state()).toBe(before)
 expect(repository.savePlan).not.toHaveBeenCalled()
 expect(repository.applyLibraryPlan).toHaveBeenCalledTimes(1)
})

it('converges a second session after its stale application conflicts without a second server revision', async () => {
 const initial = plan('personal', 7), repository = backend(initial), first = session(repository, initial), second = session(repository, initial)
 first.sync.acceptRemote('plan', await repository.applyLibraryPlan('professional', first.state().planServerRevision))
 await expect(repository.applyLibraryPlan('personal', second.state().planServerRevision)).rejects.toMatchObject({ code: '40001' })
 second.sync.acceptRemote('plan', await repository.loadPlan())
 expect(second.state()).toEqual(first.state())
 expect(repository.snapshot().schedule.revision).toBe(8)
 expect(repository.savePlan).not.toHaveBeenCalled()
 expect(repository.applyLibraryPlan).toHaveBeenCalledTimes(2)
})
