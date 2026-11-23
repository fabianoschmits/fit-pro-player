import { describe, expect, it } from 'vitest'

const load = () => import('./training-dto.js')

const row = (overrides = {}) => ({
  id: 'session-1', user_id: 'account-1', routine_id: null, assignment_id: null,
  status: 'active', revision: 3, writer_token: 'writer-1', mass_unit: 'kg',
  prescription_snapshot: { title: 'Push', exercises: [] },
  started_at: '2026-10-19T10:00:00Z', completed_at: null, updated_at: '2026-10-19T10:01:00Z',
  ...overrides,
})

describe('training DTOs', () => {
  it('normalizes optional snapshot and completion metadata without discarding malformed historical rows', async () => {
    const { parseCompletedWorkoutRecords, parseWorkoutSession } = await load()
    const comparison = { version: 1, origin: 'personal', planned: [{ exerciseId: 'bench', workSets: 3, muscleWeights: { chest: 1 } }], adjusted: null, flexApplied: false }
    const source = row({ prescription_snapshot: { comparison, exercises: [] } })
    const parsed = parseWorkoutSession(source, 'account-1')
    source.prescription_snapshot.comparison.planned[0].muscleWeights.chest = 99
    expect(parsed.prescriptionSnapshot.comparison.planned[0].muscleWeights.chest).toBe(1)
    const records = parseCompletedWorkoutRecords({
      sessions: [row({ status: 'completed', prescription_snapshot: { comparison: { version: 99 }, exercises: [] } })],
      operations: [{ session_id: 'session-1', user_id: 'account-1', kind: 'session_completed', payload: { workout: { id: 'session-1', entries: [], comparison: { version: 99 } } } }],
    }, 'account-1')
    expect(records).toHaveLength(1)
    expect(records[0].session.prescriptionSnapshot).not.toHaveProperty('comparison')
    expect(records[0].workout).toEqual({ id: 'session-1', entries: [] })
  })

  it('recovers execution comparison from owner-scoped operations while preserving the original reference', async () => {
    const { parseActiveWorkoutSession } = await load()
    const planned = [{ exerciseId: 'bench', workSets: 4, muscleWeights: { chest: 1 } }]
    const snapshot = { version: 1, origin: 'professional', planned, adjusted: null, flexApplied: false }
    const execution = { ...snapshot, planned: [{ exerciseId: 'edited', workSets: 99, muscleWeights: {} }], adjusted: [{ exerciseId: 'bench', workSets: 2, muscleWeights: { chest: 1 } }], flexApplied: true }
    const source = row({ prescription_snapshot: { comparison: snapshot, exercises: [] } })
    const operations = [
      { session_id: 'session-1', user_id: 'account-1', kind: 'set_upserted', session_revision: 2, payload: { active: { comparison: execution } } },
      { session_id: 'session-1', user_id: 'account-1', kind: 'set_upserted', session_revision: 3, payload: { active: { comparison: { version: 999 } } } },
    ]
    expect(parseActiveWorkoutSession(source, operations, 'account-1').prescriptionSnapshot.comparison).toEqual({
      version: 1, origin: 'professional', planned: [{ exerciseId: 'bench', workSets: 4, muscleWeights: { chest: 1 } }],
      adjusted: [{ exerciseId: 'bench', workSets: 2, muscleWeights: { chest: 1 } }], flexApplied: true,
    })
    expect(() => parseActiveWorkoutSession(source, [{ ...operations[0], user_id: 'account-2' }], 'account-1')).toThrow('invalid-workout-operation')
    expect(() => parseActiveWorkoutSession(source, [{ ...operations[0], session_id: 'foreign-session' }], 'account-1')).toThrow('invalid-workout-operation')
  })

  it('preserves the starting reference when reconstructing completed history from a later payload', async () => {
    const { parseCompletedWorkoutRecords } = await load()
    const original = { version: 1, origin: 'professional', planned: [{ exerciseId: 'bench', workSets: 4, muscleWeights: { chest: 1 } }], adjusted: null, flexApplied: false }
    const changed = { ...original, planned: [{ exerciseId: 'edited', workSets: 99, muscleWeights: {} }], adjusted: [{ exerciseId: 'bench', workSets: 2, muscleWeights: { chest: 1 } }], flexApplied: true }
    const records = parseCompletedWorkoutRecords({
      sessions: [row({ status: 'completed', prescription_snapshot: { comparison: original, exercises: [] } })],
      operations: [{ session_id: 'session-1', user_id: 'account-1', kind: 'session_completed', payload: { workout: { id: 'session-1', entries: [], comparison: changed } } }],
    }, 'account-1')
    expect(records[0].workout.comparison).toEqual({
      version: 1, origin: 'professional', planned: [{ exerciseId: 'bench', workSets: 4, muscleWeights: { chest: 1 } }],
      adjusted: [{ exerciseId: 'bench', workSets: 2, muscleWeights: { chest: 1 } }], flexApplied: true,
    })
  })

  it('maps a server workout session without leaking snake_case into views', async () => {
    const { parseWorkoutSession } = await load()
    expect(parseWorkoutSession(row(), 'account-1')).toEqual({
      id: 'session-1', accountId: 'account-1', routineId: null, assignmentId: null,
      status: 'active', revision: 3, writerToken: 'writer-1', massUnit: 'kg',
      prescriptionSnapshot: { title: 'Push', exercises: [] },
      startedAt: '2026-10-19T10:00:00Z', completedAt: null, updatedAt: '2026-10-19T10:01:00Z',
    })
  })

  it('rejects malformed, foreign, non-kg and unsupported session responses', async () => {
    const { parseWorkoutSession } = await load()
    for (const invalid of [null, row({ revision: 0 }), row({ user_id: 'account-2' }), row({ mass_unit: 'lb' }), row({ status: 'paused' }), row({ prescription_snapshot: [] })]) {
      expect(() => parseWorkoutSession(invalid, 'account-1')).toThrow('invalid-workout-session')
    }
  })

  it('maps preferences, routines and completed history with exact owner checks', async () => {
    const { parsePreferences, parsePlan, parseWorkoutHistory } = await load()
    expect(parsePreferences({ user_id: 'account-1', revision: 2, display_unit: 'lb', mass_unit: 'kg', state_schema_version: 2, preferences: { lang: 'pt' }, updated_at: 'now' }, 'account-1'))
      .toEqual({ accountId: 'account-1', revision: 2, displayUnit: 'lb', massUnit: 'kg', stateSchemaVersion: 2, values: { lang: 'pt' }, updatedAt: 'now' })
    expect(parsePlan({ routines: [{ id: 'r1', user_id: 'account-1', revision: 1, title: 'A', position: 0, prescription: {}, created_at: 'a', updated_at: 'b' }], schedule: { user_id: 'account-1', revision: 1, mode: 'weekly', schedule: { monday: 'r1' }, updated_at: 'b' } }, 'account-1')).toMatchObject({ routines: [{ id: 'r1', accountId: 'account-1', title: 'A' }], schedule: { mode: 'weekly' } })
    expect(parseWorkoutHistory([row({ status: 'completed', completed_at: '2026-10-19T11:00:00Z' })], 'account-1')).toMatchObject([{ id: 'session-1', status: 'completed' }])
    expect(() => parsePreferences({ user_id: 'account-2' }, 'account-1')).toThrow('invalid-account-preferences')
  })

  it('keeps the structured session note when loading completed history', async () => {
    const { parseCompletedWorkoutRecords } = await load()
    expect(parseCompletedWorkoutRecords({
      sessions: [row({ status: 'completed', completed_at: '2026-10-19T11:00:00Z', note: 'Boa energia hoje.' })],
      operations: [{ session_id: 'session-1', user_id: 'account-1', kind: 'session_completed', payload: { workout: { id: 'session-1', entries: [] } } }],
    }, 'account-1')).toEqual([{ session: expect.objectContaining({ note: 'Boa energia hoje.' }), workout: { id: 'session-1', entries: [], note: 'Boa energia hoje.' } }])
  })

  it('maps body records into the view contract and rejects foreign or malformed values', async () => {
    const { parseBodyData } = await load()
    expect(parseBodyData({
      revision: 3,
      weights: [{ id: 'weight-1', user_id: 'account-1', measured_on: '2026-10-19', weight_kg: 80.25, created_at: 'a', updated_at: 'b' }],
      measurements: [{ id: 'measure-1', user_id: 'account-1', measured_on: '2026-10-19', measurements_cm: { chest: 100.5 }, note: 'after training', created_at: 'a', updated_at: 'b' }],
    }, 'account-1')).toEqual({
      revision: 3,
      weights: [{ id: 'weight-1', accountId: 'account-1', date: '2026-10-19', weightKg: 80.25, createdAt: 'a', updatedAt: 'b' }],
      measurements: [{ id: 'measure-1', accountId: 'account-1', date: '2026-10-19', valuesCm: { chest: 100.5 }, note: 'after training', createdAt: 'a', updatedAt: 'b' }],
    })
    expect(() => parseBodyData({ revision: 3, weights: [{ id: 'weight-1', user_id: 'account-2' }], measurements: [] }, 'account-1')).toThrow('invalid-bodyweight-entry')
    expect(() => parseBodyData({ revision: 3, weights: [{ id: 'weight-1', user_id: 'account-1', measured_on: '2026-02-31', weight_kg: 80, created_at: 'a', updated_at: 'b' }], measurements: [] }, 'account-1')).toThrow('invalid-bodyweight-entry')
    expect(() => parseBodyData({ revision: 3, weights: [], measurements: [{ id: 'measure-1', user_id: 'account-1', measured_on: 'x', measurements_cm: [] }] }, 'account-1')).toThrow('invalid-body-measurement-checkin')
  })

  it('pairs completed sessions with their immutable completion payload', async () => {
    const { parseCompletedWorkoutRecords } = await load()
    expect(parseCompletedWorkoutRecords({
      sessions: [row({ status: 'completed', completed_at: '2026-10-19T11:00:00Z' })],
      operations: [{ session_id: 'session-1', user_id: 'account-1', kind: 'session_completed', payload: { workout: { id: 'session-1', entries: [] } } }],
    }, 'account-1')).toEqual([{ session: expect.objectContaining({ id: 'session-1', status: 'completed' }), workout: { id: 'session-1', entries: [] } }])
    expect(() => parseCompletedWorkoutRecords({ sessions: [row({ status: 'completed' })], operations: [{ session_id: 'session-1', user_id: 'account-2', kind: 'session_completed', payload: {} }] }, 'account-1')).toThrow('invalid-workout-operation')
  })
})

it.each([undefined, -1, 1.5, '2', NaN, Number.MAX_SAFE_INTEGER + 1])('rejects a malformed body revision %s before accepting its rows', async revision => {
 const {parseBodyData}=await load()
 expect(()=>parseBodyData({revision,weights:[],measurements:[]},'account-1')).toThrow('invalid-body-data')
})
