import { describe, expect, it } from 'vitest'
import { ensureStarterRoutines, readyMadeRoutines } from './starter.js'
import { isManagedPersonalizedRoutine } from './personalized-plan.js'
import { projectPersistedState } from './persisted-state.js'
import { estimateWorkoutDuration } from './workout-duration.js'

describe('ready-made duration catalogue integration', () => {
  it('uses the current preference in every available template and preserves ownership after reload', () => {
    const state = { profile: { goal: 'lose_weight', experience: 'beginner', preferredWorkoutMinutes: 40 }, routines: [] }
    const ready = readyMadeRoutines(state)
    expect(ready).toHaveLength(29)
    expect(new Set(ready.map(routine => routine.starterKey)).size).toBe(29)
    for (const routine of ready) {
      expect(estimateWorkoutDuration(routine.ex)).toBeLessThanOrEqual(40 * 60)
      expect(routine.planTargetMinutes).toBe(40)
    }
    state.routines = ready
    const restored = JSON.parse(JSON.stringify(projectPersistedState(state)))
    expect(restored.routines.every(isManagedPersonalizedRoutine)).toBe(true)
    expect(restored.routines.every(routine => routine.planTemplateVersion === 2 && routine.planTargetMinutes === 40)).toBe(true)
  })
  it('adds missing options once and leaves existing manual prescriptions unchanged', () => {
    const manual = { id: 'custom', name: 'Meu treino', starterKey: 'Chest Day', starterCustomName: true, ex: [{ id: '0025', sets: 9, reps: 5, weight: 99 }] }
    const state = { routines: [structuredClone(manual)] }
    ensureStarterRoutines(state)
    expect(state.routines.find(routine => routine.id === 'custom')).toEqual(manual)
    const once = structuredClone(state)
    ensureStarterRoutines(state)
    expect(state).toEqual(once)
  })
})
