import { describe, expect, it } from 'vitest'
import { starterRoutines, annotateStarterRoutines } from './starter.js'
import { EXIDX, isBodyweightEq } from './exercises.js'
import { EXERCISE_SPRITE_EXERCISE_IDS } from './exercise-guide-assets.js'

describe('starter plan', () => {
  it('uses focused sessions with explicit rest and correct bodyweight defaults', () => {
    for (const routine of starterRoutines()) {
      expect(routine.ex.reduce((sum, ex) => sum + ex.sets, 0)).toBeLessThanOrEqual(18)
      for (const entry of routine.ex) {
        expect(entry.rest).toBeGreaterThanOrEqual(60)
        if (isBodyweightEq(entry.id)) {
          expect(entry.bodyweight).toBe(true)
          expect(entry.weight).toBe(0)
        }
        expect(entry.mode || 'reps').toBe('reps')
        expect(EXIDX[entry.id].bp).not.toBe('cardio')
      }
    }
    const shoulders = starterRoutines().find(r => r.starterKey === 'Shoulders Day')
    expect(shoulders.ex.filter(ex => ['1457', '0405', '2137'].includes(ex.id))).toHaveLength(1)
  })

  it('refreshes recognized legacy built-ins without changing ids, schedule or history', () => {
    const state = { routines: [{ id: 'legacy', name: 'Back Day', ex: [['0652', 4, 10], ['0027', 4, 8], ['2330', 3, 10], ['1323', 3, 10], ['0293', 3, 10], ['0076', 3, 12]].map(([id, sets, reps]) => ({ id, sets, reps, weight: id === '0652' ? 0 : 20 })) }], week: { 1: 'legacy' }, workouts: [{ entries: [{ id: '2330' }] }] }
    annotateStarterRoutines(state)
    expect(state.routines[0].ex.map(ex => ex.id)).toEqual(starterRoutines()[1].ex.map(ex => ex.id))
    expect(state.routines[0].id).toBe('legacy')
    expect(state.week).toEqual({ 1: 'legacy' })
    expect(state.workouts[0].entries[0].id).toBe('2330')
    const once = structuredClone(state)
    annotateStarterRoutines(state)
    expect(state).toEqual(once)
  })

  it('preserves customized and assigned routines even if they carry a starter label', () => {
    const routines = [{ ...starterRoutines()[0], starterKey: 'Chest Day', ex: [{ id: '0025', sets: 2, reps: 15 }] }, { id: 'assigned', assigned: true, ex: '0652|0027|2330|1323|0293|0076'.split('|').map(id => ({ id })) }]
    const expected = structuredClone(routines)
    annotateStarterRoutines({ routines })
    expect(routines).toEqual(expected)
  })
  it('does not replace an old built-in whose prescription was customized', () => {
    const routine = { id: 'edited', starterKey: 'Chest Day', ex: [['0025', 4, 8], ['0047', 3, 10], ['0289', 3, 10], ['0308', 3, 12], ['0251', 3, 10], ['0314', 3, 10]].map(([id, sets, reps]) => ({ id, sets, reps, weight: 30 })) }
    routine.ex[0] = { ...routine.ex[0], sets: 5, rest: 180, notes: 'Preservar' }
    const before = structuredClone(routine)
    annotateStarterRoutines({ routines: [routine] })
    expect(routine).toEqual(before)
  })
  it('refreshes old default prescriptions even when the exercise ids did not change', () => {
    const legs = { id: 'legs', starterKey: 'Leg Day', ex: [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]].map(([id, sets, reps]) => ({ id, sets, reps, weight: 40 })) }
    annotateStarterRoutines({ routines: [legs] })
    expect(legs.ex.reduce((sum, entry) => sum + entry.sets, 0)).toBe(16)
    expect(legs.ex.every(entry => entry.rest > 0 && entry.mode === 'reps')).toBe(true)
    expect(legs.ex.every(entry => entry.weight === 40)).toBe(true)
    const first = structuredClone(legs)
    annotateStarterRoutines({ routines: [legs] })
    expect(legs).toEqual(first)
  })
  it('uses only exercises that are available with local animations', () => {
    const active = new Set(EXERCISE_SPRITE_EXERCISE_IDS)
    const routines = starterRoutines()

    expect(routines).toHaveLength(7)
    expect(routines.every(routine => routine.ex.length >= 4)).toBe(true)
    expect(routines.flatMap(routine => routine.ex).every(exercise => active.has(exercise.id))).toBe(true)
  })

  it('creates fresh routine ids and independent exercise lists', () => {
    const first = starterRoutines()
    const second = starterRoutines()

    expect(new Set(first.map(routine => routine.id)).size).toBe(7)
    expect(first.map(routine => routine.id)).not.toEqual(second.map(routine => routine.id))
    first[0].ex.pop()
    expect(second[0].ex).toHaveLength(first[0].ex.length + 1)
  })
})
