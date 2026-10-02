import { describe, expect, it } from 'vitest'
import { enqueueProfessionalEvent, flushProfessionalEvents } from './professional-events.js'

function localStore(accountId = 'student') {
  let scope = { userId: accountId }
  let state = { pendingProfessionalEvents: [] }
  return { getState: () => ({ S: state, getActiveLocalScope: () => scope, update: mut => { const copy = structuredClone(state); mut(copy); state = copy } }), restore: value => { state = value }, switch: id => { scope = { userId: id }; state = { pendingProfessionalEvents: [] } } }
}
describe('durable professional outbox', () => {
  it('retains offline events, rehydrates them and replays start before completion with full payload', async () => {
    const store = localStore()
    store.getState().update(s => { enqueueProfessionalEvent(s, { accountId: 'student', type: 'start', executionId: 'e', assignmentId: 'a', dayKey: 'monday', payload: { prescription: [{ weight: 40 }] } }); enqueueProfessionalEvent(s, { accountId: 'student', type: 'complete', executionId: 'e', payload: { entries: [{ sets: [{ done: true, w: 35 }] }] } }) })
    const offline = { rpc: async () => ({ error: new Error('offline') }) }
    await flushProfessionalEvents({ store, client: offline, userId: 'student' })
    expect(store.getState().S.pendingProfessionalEvents).toHaveLength(2)
    store.restore(JSON.parse(JSON.stringify(store.getState().S)))
    const calls = []
    await flushProfessionalEvents({ store, client: { rpc: async (name, args) => { calls.push([name, args]); return { data: { id: 'e' } } } }, userId: 'student' })
    expect(calls.map(([name]) => name)).toEqual(['start_workout_execution', 'complete_workout_execution'])
    expect(calls[1][1].p_payload.entries[0].sets[0].w).toBe(35)
    expect(store.getState().S.pendingProfessionalEvents).toEqual([])
  })
  it('does not remove another account events when an in-flight response arrives', async () => {
    const store = localStore('a'); store.getState().update(s => enqueueProfessionalEvent(s, { accountId: 'a', type: 'abandon', executionId: 'e' }))
    let resolve
    const request = flushProfessionalEvents({ store, client: { rpc: () => new Promise(done => { resolve = done }) }, userId: 'a' })
    await Promise.resolve()
    store.switch('b'); store.getState().update(s => enqueueProfessionalEvent(s, { accountId: 'b', type: 'start', executionId: 'b-session' }))
    resolve({ data: { id: 'e' } }); await request
    expect(store.getState().S.pendingProfessionalEvents[0].executionId).toBe('b-session')
  })
  it('deduplicates replayed local lifecycle events and refuses a mismatched authenticated scope', async () => {
    const store = localStore('a'); const event = { accountId: 'a', type: 'start', executionId: 'e' }
    store.getState().update(s => { enqueueProfessionalEvent(s, event); enqueueProfessionalEvent(s, event) })
    expect(store.getState().S.pendingProfessionalEvents).toHaveLength(1)
    let requests = 0
    await flushProfessionalEvents({ store, userId: 'b', client: { rpc: async () => { requests++; return {} } } })
    expect(requests).toBe(0)
  })
  it('retains a revoked execution visibly without blocking unrelated queued sessions', async () => {
    const store = localStore(); store.getState().update(s => { enqueueProfessionalEvent(s, { accountId: 'student', type: 'complete', executionId: 'revoked' }); enqueueProfessionalEvent(s, { accountId: 'student', type: 'start', executionId: 'active' }) })
    await flushProfessionalEvents({ store, userId: 'student', client: { rpc: async (_name, args) => args.p_execution_id === 'revoked' ? { error: { code: '42501' } } : { data: { id: 'active' } } } })
    expect(store.getState().S.pendingProfessionalEvents).toEqual([expect.objectContaining({ executionId: 'revoked', blocked: true, lastError: '42501' })])
  })
  it('lets the new account flush while the old account response is still pending', async () => {
    const store = localStore('a'); store.getState().update(s => enqueueProfessionalEvent(s, { accountId: 'a', type: 'start', executionId: 'a-session' }))
    let resolve
    const old = flushProfessionalEvents({ store, userId: 'a', client: { rpc: () => new Promise(done => { resolve = done }) } })
    store.switch('b'); store.getState().update(s => enqueueProfessionalEvent(s, { accountId: 'b', type: 'start', executionId: 'b-session' }))
    await flushProfessionalEvents({ store, userId: 'b', client: { rpc: async () => ({ data: { id: 'b-session' } }) } })
    expect(store.getState().S.pendingProfessionalEvents).toEqual([])
    resolve({ data: { id: 'a-session' } }); await old
  })
})
