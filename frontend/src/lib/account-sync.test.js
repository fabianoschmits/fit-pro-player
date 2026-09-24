import { describe, expect, it, vi } from 'vitest'
import { REMOTE_SYNC_STATE, createAccountSyncService, readSyncMetadata, validateRemoteSnapshot, writeSyncMetadata } from './account-sync.js'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const scope = { kind: 'account', userId: USER_A }
const storage = () => ({ data: new Map(), getItem(k) { return this.data.get(k) ?? null }, setItem(k, v) { this.data.set(k, String(v)) } })

describe('account sync service', () => {
  it('rejects anonymous scopes and invalid remote ownership/schema', async () => {
    const service = createAccountSyncService({ scope: { kind: 'anonymous', userId: null } })
    expect((await service.sync()).state).toBe(REMOTE_SYNC_STATE.ERROR)
    expect(validateRemoteSnapshot({ user_id: USER_A, revision: 1, state_schema_version: 2, payload: {} }, USER_A, 1)).toBeNull()
    expect(validateRemoteSnapshot({ user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', revision: 1, state_schema_version: 1, payload: {} }, USER_A, 1)).toBeNull()
  })

  it('distinguishes absent, remote-ahead, local-ahead and in-sync states', async () => {
    const store = storage()
    const from = vi.fn().mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) })
    const service = createAccountSyncService({ client: { from }, scope, storage: store })
    expect((await service.sync({ state: {} })).state).toBe(REMOTE_SYNC_STATE.REMOTE_ABSENT)

    from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: USER_A, revision: 3, state_schema_version: 1, payload: {}, updated_at: 'now' }, error: null }) }) }) })
    expect((await service.sync({ state: {} })).state).toBe(REMOTE_SYNC_STATE.REMOTE_AHEAD)
    writeSyncMetadata(scope, { revision: 3, dirty: true }, store)
    expect((await service.sync({ state: {} })).state).toBe(REMOTE_SYNC_STATE.LOCAL_AHEAD)
    writeSyncMetadata(scope, { revision: 3, dirty: false }, store)
    expect((await service.sync({ state: {} })).state).toBe(REMOTE_SYNC_STATE.IN_SYNC)
    expect(readSyncMetadata(scope, store)).toEqual({ revision: 3, dirty: false })
  })

  it('uses CAS RPC, persists applied revision, and never overwrites on conflict', async () => {
    const store = storage()
    const rpc = vi.fn().mockResolvedValueOnce({ data: [{ status: 'APPLIED', revision: 1, updated_at: 'one' }], error: null })
      .mockResolvedValueOnce({ data: [{ status: 'CONFLICT', revision: 4, updated_at: 'four' }], error: null })
    const service = createAccountSyncService({ client: { rpc }, scope, storage: store })
    expect(await service.uploadSnapshot({ state: { workouts: [{ id: 1 }], access_token: 'never' }, expectedRevision: 0 })).toMatchObject({ state: REMOTE_SYNC_STATE.IN_SYNC, revision: 1 })
    expect(readSyncMetadata(scope, store)).toEqual({ revision: 1, dirty: false })
    expect(await service.uploadSnapshot({ state: { workouts: [{ id: 2 }] }, expectedRevision: 1 })).toMatchObject({ state: REMOTE_SYNC_STATE.CONFLICT, remoteRevision: 4 })
    expect(rpc).toHaveBeenLastCalledWith('save_own_account_snapshot', expect.objectContaining({ p_expected_revision: 1, p_state_schema_version: 1, p_payload: expect.objectContaining({ workouts: [{ id: 2 }] }) }))
    expect(readSyncMetadata(scope, store)).toEqual({ revision: 1, dirty: false })
  })

  it('uploads the complete application state envelope, including preferences and training history', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ status: 'APPLIED', revision: 1, updated_at: 'now' }], error: null })
    const state = {
      lang: 'pt', theme: 'light', accent: 'teal', unit: 'lb', profile: { name: 'Ana' },
      routines: [{ id: 'push', ex: [{ id: 'bench', sets: [{ reps: 8, w: 60 }] }] }],
      week: { 1: 'push' }, dayPlan: { '2026-09-23': 'push' },
      workouts: [{ id: 'w1', entries: [{ id: 'bench', sets: [{ reps: 8, w: 60, done: true }] }] }],
      exWeights: { bench: { w: 60, d: '2026-09-23' } }, bodyweight: [{ d: '2026-09-23', w: 80 }],
      bodyMeasurements: [{ d: '2026-09-23', values: { chest: 100 } }], bodyMeasurementGoals: { chest: 105 },
      customEx: [{ id: 'custom-1', name: 'Cable press' }], targetW: 78, planMode: 'weekly',
      reminder: { on: true, time: '07:30', tz: 'America/Sao_Paulo' }, effort: 'rir',
      weighBeforeWorkout: false, simpleMode: false, onboardingDone: true, seenTips: { intro: true },
      active: { routineId: 'push' }, mediaSize: 'full', access_token: 'must-not-upload',
    }
    const service = createAccountSyncService({ client: { rpc }, scope })

    await service.uploadSnapshot({ state, expectedRevision: 0 })

    const payload = rpc.mock.calls[0][1].p_payload
    expect(payload).toMatchObject({
      lang: 'pt', theme: 'light', profile: { name: 'Ana' }, routines: state.routines,
      workouts: state.workouts, bodyweight: state.bodyweight, bodyMeasurements: state.bodyMeasurements,
      bodyMeasurementGoals: state.bodyMeasurementGoals, customEx: state.customEx, exWeights: state.exWeights,
      reminder: state.reminder, onboardingDone: true,
    })
    expect(payload).not.toHaveProperty('access_token')
  })

  it('keeps an in-flight account result from applying after scope generation changes', async () => {
    let currentGeneration = 1
    let resolveRead
    const read = new Promise(resolve => { resolveRead = resolve })
    const service = createAccountSyncService({
      client: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => read }) }) }) },
      scope,
      generation: 1,
      isCurrent: generation => generation === currentGeneration,
    })
    const pending = service.fetchRemoteSnapshot()
    currentGeneration = 2
    resolveRead({ data: { user_id: USER_A, revision: 1, state_schema_version: 1, payload: {}, updated_at: 'now' }, error: null })
    expect(await pending).toMatchObject({ state: REMOTE_SYNC_STATE.ERROR, error: 'stale-scope' })
  })
})
