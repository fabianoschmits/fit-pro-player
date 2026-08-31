import { describe, expect, it } from 'vitest'
import { starterRoutines } from './starter.js'
import { WORKOUT_GUIDE_EXERCISE_IDS } from './exercise-guide-assets.js'

describe('starter plan', () => {
  it('uses only exercises that are available with local animations', () => {
    const active = new Set(WORKOUT_GUIDE_EXERCISE_IDS)
    const routines = starterRoutines()

    expect(routines).toHaveLength(3)
    expect(routines.every(routine => routine.ex.length >= 5)).toBe(true)
    expect(routines.flatMap(routine => routine.ex).every(exercise => active.has(exercise.id))).toBe(true)
  })

  it('creates fresh routine ids and independent exercise lists', () => {
    const first = starterRoutines()
    const second = starterRoutines()

    expect(new Set(first.map(routine => routine.id)).size).toBe(3)
    expect(first.map(routine => routine.id)).not.toEqual(second.map(routine => routine.id))
    first[0].ex.pop()
    expect(second[0].ex).toHaveLength(6)
  })
})
