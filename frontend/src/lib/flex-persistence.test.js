import { describe, expect, it } from 'vitest'
import { projectPersistedState, projectSessionRecovery } from './persisted-state.js'
import { validateBackup } from './backup-state.js'
import { markPendingDomains } from './domain-sync-state.js'
const flex = () => ({ targetMinutes: 40, preferredMinutes: 60, estimatedMinutes: 39, mode: 'adapted', phase: 'review', outline: [
  { key: 'position:0', exerciseId: 'same', selected: true, name: 'Primeiro', sets: 3 },
  { key: 'position:1', exerciseId: 'same', selected: false, name: 'Segundo', sets: 4 },
] })
const active = () => ({ id: 'session', start: null, entries: [
  { id: 'same', sets: [{ w: 20, r: 8, done: false }] },
  { id: 'same', sets: [{ w: 30, r: 10, done: false }] },
], flex: flex() })
const backup = () => ({ routines: [], workouts: [], profile: { preferredWorkoutMinutes: 40 }, active: active() })
describe('FPP Flex persistence boundaries', () => {
  it('keeps positional review choices and incomplete rows through serialization and backups', () => {
    const projected = JSON.parse(JSON.stringify(projectPersistedState(backup())))
    expect(projected).toEqual(backup())
    expect(validateBackup(projected)).toEqual(backup())
    expect(projected.active.start).toBeNull()
  })
  it('retains managed provenance in routines and plan merge bases', () => {
    const markers = { planGenerated: true, personalizedKey: 'a', planSignature: '[signature]', planGoal: 'strength', planExperience: 'beginner', starterCustomName: true }
    const state = projectPersistedState({ routines: [{ id: 'r', ex: [], ...markers }], _syncBases: { plan: { routines: [{ id: 'r', title: 'A', prescription: { ex: [], ...markers } }] } } })
    expect(state.routines[0]).toMatchObject(markers)
    expect(state._syncBases.plan.routines[0].prescription).toMatchObject(markers)
  })
  it('keeps confirmed execution metadata in existing recovery payload and snapshot', () => {
    const workout = active()
    workout.flex.phase = 'confirmed'
    workout.entries = workout.entries.slice(0, 1)
    const draft = projectSessionRecovery({ session: { prescriptionSnapshot: { flex: workout.flex, exercises: workout.entries } }, pendingOperations: [{ operationId: 'one', kind: 'exercise_removed', payload: { active: workout } }] })
    expect(draft.pendingOperations[0].payload.active).toEqual(workout)
    expect(draft.session.prescriptionSnapshot.flex).toEqual(workout.flex)
    const state = projectPersistedState({ pendingProfessionalEvents: [{ id: 'event', payload: { flex: workout.flex, entries: workout.entries } }] })
    expect(state.pendingProfessionalEvents[0].payload.flex).toEqual(workout.flex)
  })
  it('does not sync session selection as preference or plan changes', () => {
    const previous = { routines: [], profile: { preferredWorkoutMinutes: 60 }, active: active() }
    const next = structuredClone(previous)
    next.active.flex.outline[1].selected = true
    expect(markPendingDomains(previous, next)._pendingSync).toEqual({})
    next.profile.preferredWorkoutMinutes = 45
    expect(markPendingDomains(previous, next)._pendingSync).toEqual({ preferences: true })
  })
  it.each([14, 181, 42, 40.5, '40', null])('rejects malformed preference %j in imports', value => {
    const data = backup()
    data.profile.preferredWorkoutMinutes = value
    expect(() => validateBackup(data)).toThrow('preference')
  })
  it('rejects duplicate positional metadata but imports old backups', () => {
    const data = backup()
    data.active.flex.outline[1].key = 'position:0'
    expect(() => validateBackup(data)).toThrow('active')
    expect(validateBackup({ routines: [], workouts: [] })).toEqual({ routines: [], workouts: [] })
  })
  it('rejects incomplete or mismatched review outlines before rendering', () => {
    for (const outline of [[], flex().outline.slice(0, 1), flex().outline.map((item, index) => ({ ...item, key: `position:${index + 1}` })), flex().outline.map(item => ({ ...item, exerciseId: 'other' }))]) {
      const data = backup()
      data.active.flex.outline = outline
      expect(() => validateBackup(data)).toThrow('active')
    }
  })
})
