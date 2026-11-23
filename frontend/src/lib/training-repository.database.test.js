import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createLifecycleBrowserDatabase } from '../../../scripts/lifecycle-browser-database.mjs'
import { createTrainingRepository } from './training-repository.js'
import { createSessionRecovery, readSessionRecoveryDraft } from './session-recovery.js'
import { createAccountDomainSync } from './account-domain-sync.js'
import { buildCompletedWorkout } from './finish-workout.js'

const accountA = '11111111-1111-4111-8111-111111111111'
const accountB = '22222222-2222-4222-8222-222222222222'
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const comparison = {
  version: 1, origin: 'personal',
  planned: [{ exerciseId: 'custom-lift', workSets: 4, muscleWeights: { chest: 1, triceps: 0.5 } }],
  adjusted: null, flexApplied: false,
}
const executed = {
  ...comparison,
  adjusted: [{ exerciseId: 'custom-lift', workSets: 2, muscleWeights: { chest: 1, triceps: 0.5 } }],
  flexApplied: true,
}

// Use the real Supabase SDK, domain repositories, PostgreSQL engine, production
// RPCs and RLS. This transport only substitutes for a local PostgREST process.
describe('training comparison with the authenticated database', () => {
  let database
  let loseCompletionResponse = false
  beforeAll(async () => {
    database = await createLifecycleBrowserDatabase()
    await database.db.query('insert into auth.users(id) values($1),($2)', [accountA, accountB])
  }, 60000)
  afterAll(async () => { await database?.close() })

  const client = actor => createClient('http://127.0.0.1:54321', 'local-test-key', {
    accessToken: async () => actor,
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input))
      const owner = new Headers(init?.headers).get('authorization')?.replace(/^Bearer /, '')
      try {
        let data
        if (url.pathname.startsWith('/rest/v1/rpc/')) {
          const name = url.pathname.split('/').at(-1)
          data = await database.rpc(owner, name, JSON.parse(init.body))
          if (name === 'complete_workout_session' && loseCompletionResponse) {
            loseCompletionResponse = false
            throw new TypeError('Failed to fetch: completion response lost')
          }
        } else {
          const table = url.pathname.split('/').at(-1)
          if (!['workout_sessions', 'workout_session_operations'].includes(table)) throw new Error('unsupported test table')
          const columns = url.searchParams.get('select') || '*'
          if (columns !== '*' && !/^[a-z_,]+$/.test(columns)) throw new Error('invalid test columns')
          const args = [], conditions = []
          for (const [key, value] of url.searchParams) {
            if (/^[a-z_]+$/.test(key) && value.startsWith('eq.')) {
              args.push(value.slice(3))
              conditions.push(`${key}=$${args.length}`)
            }
          }
          const order = url.searchParams.get('order')
          if (order && !/^[a-z_]+\.(asc|desc)$/.test(order)) throw new Error('invalid test order')
          const limit = Number(url.searchParams.get('limit') || 1000)
          if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('invalid test limit')
          const result = await database.queryAs(owner, `select ${columns} from public.${table}${conditions.length ? ` where ${conditions.join(' and ')}` : ''}${order ? ` order by ${order.replace('.', ' ')}` : ''} limit ${limit}`, args)
          data = new Headers(init?.headers).get('accept')?.includes('vnd.pgrst.object') ? result.rows[0] || null : result.rows
        }
        return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
      } catch (error) {
        if (error instanceof TypeError && error.message.startsWith('Failed to fetch')) throw error
        return new Response(JSON.stringify({ code: error.code, message: error.message }), { status: error.code === '42501' ? 403 : 400, headers: { 'content-type': 'application/json' } })
      }
    } },
  })

  it('reconnects, replays a lost response once and reconstructs immutable history in a new account context', async () => {
    const values = new Map()
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
    let online = false
    const repository = createTrainingRepository({ client: client(accountA), accountId: accountA })
    const recovery = createSessionRecovery({ repository, accountId: accountA, storage, isOnline: () => online })
    const active = {
      id: sessionId, d: '2026-11-23', start: 1000, name: 'Custom day', comparison: structuredClone(executed),
      entries: [{ id: 'custom-lift', muscleSnapshot: { n: 'Original lift', muscleWeights: { chest: 1, triceps: 0.5 } }, sets: [{ done: true, w: 30, r: 8 }] }],
    }
    await recovery.start({ sessionId, prescriptionSnapshot: { comparison, exercises: active.entries, name: active.name } })
    expect(readSessionRecoveryDraft({ accountId: accountA, storage }).session.prescriptionSnapshot.comparison.adjusted).toBeNull()
    expect(readSessionRecoveryDraft({ accountId: accountB, storage })).toBeNull()
    await recovery.enqueue({ operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', kind: 'set_upserted', payload: { active } })
    online = true
    await expect(recovery.flush()).resolves.toMatchObject({ state: 'saved' })
    expect(readSessionRecoveryDraft({ accountId: accountA, storage }).session.prescriptionSnapshot.comparison).toEqual(executed)

    const anotherContext = createTrainingRepository({ client: client(accountA), accountId: accountA })
    await expect(anotherContext.loadActiveSession()).resolves.toMatchObject({ prescriptionSnapshot: { comparison: executed } })
    const stranger = createTrainingRepository({ client: client(accountB), accountId: accountB })
    await expect(stranger.loadActiveSession()).resolves.toBeNull()
    await expect(stranger.takeOverSession({ sessionId, expectedRevision: 2 })).rejects.toMatchObject({ kind: 'session-missing' })

    loseCompletionResponse = true
    const workout = buildCompletedWorkout(active, { end: 5000 })
    const completionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    await expect(recovery.complete({ operationId: completionId, kind: 'session_completed', payload: { workout, comparison: active.comparison, massUnit: 'kg' } })).resolves.toMatchObject({ state: 'waiting' })
    expect(readSessionRecoveryDraft({ accountId: accountA, storage }).pendingOperations[0].payload.workout.comparison).toEqual(executed)
    recovery.dispose()

    const restored = createSessionRecovery({ repository: anotherContext, accountId: accountA, storage })
    await expect(restored.flush()).resolves.toMatchObject({ state: 'saved', completed: true })
    expect(readSessionRecoveryDraft({ accountId: accountA, storage })).toBeNull()
    const stored = await database.queryAs(accountA, 'select payload from public.workout_session_operations where session_id=$1 and operation_id=$2', [sessionId, completionId])
    expect(stored.rows).toHaveLength(1)
    expect(stored.rows[0].payload.workout.comparison).toEqual(executed)

    const history = await anotherContext.loadHistory()
    expect(history).toHaveLength(1)
    expect(history[0].workout.comparison).toEqual(executed)
    expect(history[0].workout.entries[0].muscleSnapshot).toEqual({ n: 'Original lift', muscleWeights: { chest: 1, triceps: 0.5 } })
    let state = { workouts: [], _pendingSync: {} }
    const sync = createAccountDomainSync({ repository: anotherContext, getState: () => state, replaceState: next => { state = next }, isCurrent: () => true, isOnline: () => true })
    sync.acceptRemote('history', history)
    expect(state.workouts[0].comparison).toEqual(executed)
    await expect(stranger.loadHistory()).resolves.toEqual([])
    const leaked = await database.queryAs(accountB, 'select id from public.workout_sessions where id=$1', [sessionId])
    expect(leaked.rows).toEqual([])
    restored.dispose()
    sync.dispose()
  }, 15000)
})
