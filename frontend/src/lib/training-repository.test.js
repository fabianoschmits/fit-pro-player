import { describe, expect, it, vi } from 'vitest'

const load = () => import('./training-repository.js')
const session = (overrides = {}) => ({ id: 'session-1', user_id: 'account-1', routine_id: null, assignment_id: null, status: 'active', revision: 1, writer_token: 'writer-1', mass_unit: 'kg', prescription_snapshot: { exercises: [] }, started_at: 'start', completed_at: null, updated_at: 'updated', ...overrides })

function clientWithRpc(resolver) {
  return { rpc: vi.fn(resolver) }
}

describe('training repository', () => {
  it('sends exact session RPC arguments and maps returned sessions', async () => {
    const { createTrainingRepository } = await load()
    const client = clientWithRpc(async (name) => ({ data: session({ status: name === 'complete_workout_session' ? 'completed' : 'active', completed_at: name === 'complete_workout_session' ? 'done' : null }), error: null }))
    const repo = createTrainingRepository({ client, accountId: 'account-1' })
    await repo.startSession({ sessionId: 'session-1', prescriptionSnapshot: { exercises: [] }, routineId: null, assignmentId: null })
    await repo.appendOperation({ sessionId: 'session-1', writerToken: 'writer-1', expectedRevision: 1, operationId: 'operation-1', kind: 'set_upserted', payload: { setId: 's1' } })
    await repo.takeOverSession({ sessionId: 'session-1', expectedRevision: 1 })
    await repo.completeSession({ sessionId: 'session-1', writerToken: 'writer-1', expectedRevision: 1, operationId: 'operation-2', payload: { durationMs: 1000 } })
    await repo.abandonSession({ sessionId: 'session-1', writerToken: 'writer-1', expectedRevision: 1, operationId: 'operation-3', payload: { reason: 'discarded' } })
    expect(client.rpc.mock.calls).toEqual([
      ['start_workout_session', { p_session_id: 'session-1', p_prescription_snapshot: { exercises: [] }, p_routine_id: null, p_assignment_id: null }],
      ['append_workout_operation', { p_session_id: 'session-1', p_writer_token: 'writer-1', p_expected_revision: 1, p_operation_id: 'operation-1', p_kind: 'set_upserted', p_payload: { setId: 's1' } }],
      ['take_over_workout_session', { p_session_id: 'session-1', p_expected_revision: 1 }],
      ['complete_workout_session', { p_session_id: 'session-1', p_writer_token: 'writer-1', p_expected_revision: 1, p_operation_id: 'operation-2', p_payload: { durationMs: 1000 } }],
      ['abandon_workout_session', { p_session_id: 'session-1', p_writer_token: 'writer-1', p_expected_revision: 1, p_operation_id: 'operation-3', p_payload: { reason: 'discarded' } }],
    ])
  })

  it('drops legacy non-UUID plan references when recreating a persisted session', async () => {
    const { createTrainingRepository } = await load()
    const client = clientWithRpc(async () => ({ data: session(), error: null }))
    const repo = createTrainingRepository({ client, accountId: 'account-1' })

    await repo.startSession({
      sessionId: 'session-1',
      prescriptionSnapshot: { exercises: [] },
      routineId: 'year-push',
      assignmentId: 'program-assignment',
    })

    expect(client.rpc).toHaveBeenCalledWith('start_workout_session', expect.objectContaining({
      p_routine_id: null,
      p_assignment_id: null,
    }))
  })

  it('rejects malformed RPC data and a response owned by another account', async () => {
    const { createTrainingRepository } = await load()
    const malformed = createTrainingRepository({ client: clientWithRpc(async () => ({ data: null, error: null })), accountId: 'account-1' })
    await expect(malformed.startSession({ sessionId: 's', prescriptionSnapshot: {} })).rejects.toMatchObject({ kind: 'invalid-response' })
    const foreign = createTrainingRepository({ client: clientWithRpc(async () => ({ data: session({ user_id: 'account-2' }), error: null })), accountId: 'account-1' })
    await expect(foreign.startSession({ sessionId: 's', prescriptionSnapshot: {} })).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it.each([
    [{ code: '40001', message: 'stale workout writer' }, 'stale-writer', false],
    [{ code: '40001', message: 'workout revision conflict' }, 'revision-conflict', true],
    [{ code: '42501', message: 'denied' }, 'forbidden', false],
    [{ code: 'PGRST301', message: 'JWT expired' }, 'forbidden', false],
    [{ code: '55000', message: 'workout session already finalized' }, 'finalized', false],
    [{ code: '23505', message: 'active workout already exists' }, 'active-session', false],
    [{ message: 'Failed to fetch' }, 'offline', true],
  ])('maps RPC error %o to %s', async (error, kind, retryable) => {
    const { createTrainingRepository } = await load()
    const repo = createTrainingRepository({ client: clientWithRpc(async () => ({ data: null, error })), accountId: 'account-1' })
    await expect(repo.startSession({ sessionId: 's', prescriptionSnapshot: {} })).rejects.toMatchObject({ kind, retryable })
  })

  it('treats an idempotent replay response as the current session', async () => {
    const { createTrainingRepository } = await load()
    const client = clientWithRpc(async () => ({ data: session({ revision: 4 }), error: null }))
    const repo = createTrainingRepository({ client, accountId: 'account-1' })
    await expect(repo.appendOperation({ sessionId: 'session-1', writerToken: 'old-token', expectedRevision: 2, operationId: 'same-operation', kind: 'set_upserted', payload: { setId: 's1' } })).resolves.toMatchObject({ id: 'session-1', revision: 4 })
  })

  it('loads plan/history and saves preferences through owner-scoped boundaries', async () => {
    const { createTrainingRepository } = await load()
    const query = (data) => ({ select: () => query(data), eq: () => query(data), order: () => query(data), limit: async () => ({ data, error: null }), maybeSingle: async () => ({ data: data[0] || null, error: null }) })
    const from = vi.fn(table => query(table === 'athlete_routines' ? [{ id: 'r1', user_id: 'account-1', revision: 1, title: 'A', position: 0, prescription: {}, created_at: 'a', updated_at: 'b' }]
      : table === 'athlete_schedules' ? [{ user_id: 'account-1', revision: 1, mode: 'weekly', schedule: {}, updated_at: 'b' }]
        : table === 'workout_session_operations' ? [{ session_id: 'session-1', user_id: 'account-1', kind: 'session_completed', payload: { workout: { id: 'session-1', entries: [] } } }]
          : [session({ status: 'completed', completed_at: 'done' })]))
    const rpc = vi.fn(async () => ({ data: { user_id: 'account-1', revision: 2, display_unit: 'lb', mass_unit: 'kg', state_schema_version: 2, preferences: {}, updated_at: 'now' }, error: null }))
    const repo = createTrainingRepository({ client: { from, rpc }, accountId: 'account-1' })
    await expect(repo.loadPlan()).resolves.toMatchObject({ routines: [{ id: 'r1' }], schedule: { mode: 'weekly' } })
    await expect(repo.loadHistory({ limit: 20 })).resolves.toMatchObject([{ session: { status: 'completed' }, workout: { id: 'session-1' } }])
    await expect(repo.savePreferences({ expectedRevision: 1, displayUnit: 'lb', values: { lang: 'pt' } })).resolves.toMatchObject({ revision: 2, displayUnit: 'lb' })
    expect(rpc).toHaveBeenCalledWith('save_account_preferences', { p_expected_revision: 1, p_display_unit: 'lb', p_preferences: { lang: 'pt' } })
  })

  it('loads preferences and body records through independently scoped reads', async () => {
    const { createTrainingRepository } = await load()
    const query = (data) => ({ select: () => query(data), eq: () => query(data), order: () => query(data), limit: async () => ({ data, error: null }), maybeSingle: async () => ({ data: data[0] || null, error: null }) })
    const from = vi.fn(table => query({
      account_preferences: [{ user_id: 'account-1', revision: 1, display_unit: 'kg', mass_unit: 'kg', state_schema_version: 2, preferences: { lang: 'pt' }, updated_at: 'now' }],
      bodyweight_entries: [{ id: 'weight-1', user_id: 'account-1', measured_on: '2026-10-19', weight_kg: 80, created_at: 'a', updated_at: 'b' }],
      body_measurement_checkins: [{ id: 'measure-1', user_id: 'account-1', measured_on: '2026-10-19', measurements_cm: { chest: 100 }, note: null, created_at: 'a', updated_at: 'b' }],
    }[table] || []))
    const repo = createTrainingRepository({ client: { from, rpc: vi.fn() }, accountId: 'account-1' })
    await expect(repo.loadPreferences()).resolves.toMatchObject({ displayUnit: 'kg', values: { lang: 'pt' } })
    await expect(repo.loadBody()).resolves.toMatchObject({ weights: [{ weightKg: 80 }], measurements: [{ valuesCm: { chest: 100 } }] })
    expect(from).toHaveBeenCalledWith('account_preferences')
    expect(from).toHaveBeenCalledWith('bodyweight_entries')
    expect(from).toHaveBeenCalledWith('body_measurement_checkins')
  })

  it('loads completion payloads alongside historical session metadata', async () => {
    const { createTrainingRepository } = await load()
    const query = data => ({ select: () => query(data), eq: () => query(data), order: () => query(data), limit: async () => ({ data, error: null }) })
    const from = vi.fn(table => query(table === 'workout_sessions'
      ? [session({ status: 'completed', completed_at: 'done' })]
      : [{ session_id: 'session-1', user_id: 'account-1', kind: 'session_completed', payload: { workout: { id: 'session-1', entries: [] } } }]))
    const repo = createTrainingRepository({ client: { from, rpc: vi.fn() }, accountId: 'account-1' })
    await expect(repo.loadHistory()).resolves.toEqual([{ session: expect.objectContaining({ id: 'session-1' }), workout: { id: 'session-1', entries: [] } }])
    expect(from).toHaveBeenCalledWith('workout_session_operations')
  })

  it('saves a UUID-backed plan through its revision-checked RPC', async () => {
    const { createTrainingRepository } = await load()
    const rpc = vi.fn(async () => ({ data: { routines: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id: 'account-1', revision: 1, title: 'Push', position: 0, prescription: { ex: [] }, created_at: 'a', updated_at: 'b' }], schedule: { user_id: 'account-1', revision: 1, mode: 'weekly', schedule: { week: {} }, updated_at: 'b' } }, error: null }))
    const repo = createTrainingRepository({ client: { rpc }, accountId: 'account-1' })
    await expect(repo.savePlan({ expectedRevision: 0, mode: 'weekly', schedule: { week: {} }, routines: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Push', prescription: { ex: [] } }] })).resolves.toMatchObject({ routines: [{ title: 'Push' }] })
    expect(rpc).toHaveBeenCalledWith('save_athlete_plan', { p_expected_revision: 0, p_mode: 'weekly', p_schedule: { week: {} }, p_routines: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Push', prescription: { ex: [] } }] })
  })

  it('saves canonical body records through the authenticated body RPC', async () => {
    const { createTrainingRepository } = await load()
    const rpc = vi.fn(async () => ({ data: { weights: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id: 'account-1', measured_on: '2026-10-19', weight_kg: 80, created_at: 'a', updated_at: 'b' }], measurements: [] }, error: null }))
    const repo = createTrainingRepository({ client: { rpc }, accountId: 'account-1' })
    await expect(repo.saveBody({ weights: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', date: '2026-10-19', weightKg: 80 }], measurements: [] })).resolves.toMatchObject({ weights: [{ weightKg: 80 }] })
    expect(rpc).toHaveBeenCalledWith('save_athlete_body', { p_weights: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', date: '2026-10-19', weightKg: 80 }], p_measurements: [] })
  })

  it('loads the current active session before a writer takeover', async () => {
    const { createTrainingRepository } = await load()
    const query = data => ({
      select: () => query(data),
      eq: () => query(data),
      maybeSingle: async () => ({ data, error: null }),
    })
    const client = { rpc: vi.fn(), from: vi.fn(() => query(session({ revision: 4, writer_token: 'current-writer' }))) }
    const repo = createTrainingRepository({ client, accountId: 'account-1' })
    await expect(repo.loadActiveSession()).resolves.toMatchObject({ id: 'session-1', revision: 4, writerToken: 'current-writer' })
    expect(client.from).toHaveBeenCalledWith('workout_sessions')
  })
})
