import { describe, expect, it } from 'vitest'
import { serializeStateOnly, readScopedState, writeScopedState } from './account-cache.js'
import { resolveLocalScope } from './local-state-scope.js'
import { projectPersistedState, projectSessionRecovery } from './persisted-state.js'

const comparison = () => ({
  version: 1, origin: 'professional',
  planned: [{ exerciseId: 'custom-lift', workSets: 4, muscleWeights: { chest: 1, triceps: 0.5 } }],
  adjusted: [{ exerciseId: 'custom-lift', workSets: 2, muscleWeights: { chest: 1, triceps: 0.5 } }],
  flexApplied: true,
})
const active = () => ({
  id: 'session-1', d: '2026-11-23', start: 1000, assignmentId: 'assignment-1', programVersionId: 'version-1',
  comparison: comparison(), entries: [{ id: 'custom-lift', muscleSnapshot: { n: 'Lift', muscleWeights: { chest: 1, triceps: 0.5 } }, sets: [{ done: true, w: 20, r: 8 }] }],
})

describe('training comparison persistence', () => {
  it('round trips independent snapshots through account storage without leaking to another account', () => {
    const values = new Map()
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
    const owner = resolveLocalScope('11111111-1111-4111-8111-111111111111')
    const other = resolveLocalScope('22222222-2222-4222-8222-222222222222')
    const state = { routines: [], workouts: [active()], active: active() }
    expect(writeScopedState(owner, state, storage)).toBe(true)
    state.active.comparison.planned[0].muscleWeights.chest = 99
    const restored = readScopedState(owner, storage, { routines: [], workouts: [] })
    expect(restored.status).toBe('valid')
    expect(restored.state.active.comparison).toEqual(comparison())
    expect(restored.state.workouts[0]).toMatchObject({ comparison: comparison(), assignmentId: 'assignment-1', programVersionId: 'version-1' })
    expect(readScopedState(other, storage, { routines: [], workouts: [] }).state.workouts).toEqual([])
  })

  it('keeps prestart null, empty freestyle and repeated provenance through JSON serialization', () => {
    const prestart = { ...comparison(), adjusted: null, flexApplied: false }
    const freestyle = { version: 1, origin: 'freestyle', planned: [], adjusted: [], flexApplied: false }
    const repeat = { ...comparison(), origin: 'repeat' }
    const state = JSON.parse(serializeStateOnly({ active: { ...active(), start: null, comparison: prestart }, workouts: [{ ...active(), comparison: freestyle }, { ...active(), comparison: repeat }] }))
    expect(state.active.comparison).toEqual(prestart)
    expect(state.workouts.map(workout => workout.comparison)).toEqual([freestyle, repeat])
  })

  it('projects comparison in recovery snapshots and existing operation/professional payloads', () => {
    const workout = active()
    const projected = JSON.parse(JSON.stringify(projectSessionRecovery({
      session: { prescriptionSnapshot: { comparison: comparison(), exercises: workout.entries } },
      pendingOperations: [{ operationId: 'operation-1', kind: 'session_completed', payload: { comparison: comparison(), active: workout, workout } }],
    })))
    expect(projected.session.prescriptionSnapshot.comparison).toEqual(comparison())
    expect(projected.session.prescriptionSnapshot.exercises[0].muscleSnapshot).toEqual(workout.entries[0].muscleSnapshot)
    expect(projected.pendingOperations[0].payload).toEqual({ comparison: comparison(), active: workout, workout })
    const events = projectPersistedState({ pendingProfessionalEvents: [{ id: 'event-1', payload: { comparison: comparison(), workout } }] })
    expect(events.pendingProfessionalEvents[0].payload).toEqual({ comparison: comparison(), workout })
  })

  it('drops invalid optional metadata while preserving ordinary historical rows', () => {
    const state = projectPersistedState({ workouts: [{ ...active(), comparison: { ...comparison(), version: 2 } }, { id: 'legacy', entries: [] }] })
    expect(state.workouts[0]).not.toHaveProperty('comparison')
    expect(state.workouts).toHaveLength(2)
    expect(state.workouts[1]).toEqual({ id: 'legacy', entries: [] })
  })
})
