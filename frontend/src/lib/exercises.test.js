import { describe, expect, it } from 'vitest'
import { EXDB as SOURCE_EXERCISES } from './exercises-data.js'
import {
  EXDB,
  EXIDX,
  PENDING_EXERCISE_COUNT,
} from './exercises.js'
import {
  WORKOUT_GUIDE_EXERCISE_IDS,
  WORKOUT_GUIDE_POPULARITY_IDS,
  hasExerciseGuideAsset,
} from './exercise-guide-assets.js'

describe('active exercise catalogue', () => {
  it('offers only exercises with a validated local animation', () => {
    expect(EXDB.map(exercise => exercise.id)).toHaveLength(WORKOUT_GUIDE_EXERCISE_IDS.length)
    expect(EXDB.every(hasExerciseGuideAsset)).toBe(true)
    expect(new Set(EXDB.map(exercise => exercise.id))).toEqual(new Set(WORKOUT_GUIDE_EXERCISE_IDS))
  })

  it('puts the researched popularity order first', () => {
    expect(EXDB.slice(0, WORKOUT_GUIDE_POPULARITY_IDS.length).map(exercise => exercise.id))
      .toEqual(WORKOUT_GUIDE_POPULARITY_IDS)
  })

  it('keeps pending source rows resolvable for existing plans and history', () => {
    expect(PENDING_EXERCISE_COUNT).toBe(SOURCE_EXERCISES.length - EXDB.length)
    const pending = SOURCE_EXERCISES.find(exercise => !WORKOUT_GUIDE_EXERCISE_IDS.includes(exercise.id))
    expect(pending).toBeTruthy()
    expect(EXDB).not.toContain(pending)
    expect(EXIDX[pending.id]).toBe(pending)
  })
})
