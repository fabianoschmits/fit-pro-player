import { describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import {
  SVG_EXERCISE_IDS,
  SVG_EXERCISE_MOTIONS,
  exerciseSvgMotion,
  hasExerciseSvgMotion,
} from './exercise-svg-motions.js'

describe('exercise SVG motion prototypes', () => {
  it('covers exactly the first ten catalogue exercises', () => {
    expect(SVG_EXERCISE_IDS).toEqual(EXDB.slice(0, 10).map(exercise => exercise.id))
  })

  it.each(SVG_EXERCISE_IDS)('keeps %s as a complete, finite pose sequence', id => {
    const motion = SVG_EXERCISE_MOTIONS[id]
    expect(motion.poses.length).toBeGreaterThanOrEqual(4)
    expect(motion.offsets).toHaveLength(motion.poses.length)
    expect(motion.offsets[0]).toBe(0)
    expect(motion.offsets.at(-1)).toBe(1)
    expect(motion.duration).toBeGreaterThanOrEqual(4000)
    expect(motion.duration).toBeLessThanOrEqual(6500)
    expect(motion.poster).toBeGreaterThanOrEqual(0)
    expect(motion.poster).toBeLessThanOrEqual(1)

    for (const pose of motion.poses) {
      expect(pose.hip).toHaveLength(2)
      expect(Object.values(pose).flat(Infinity).filter(value => typeof value === 'number').every(Number.isFinite)).toBe(true)
    }
  })

  it('uses only code-native declarations and no linked media', () => {
    const source = JSON.stringify(SVG_EXERCISE_MOTIONS)
    expect(source).not.toMatch(/https?:|\.png|\.jpe?g|\.gif|\.webp/i)
  })

  it('resolves prototypes by exercise and leaves later entries on the existing fallback', () => {
    expect(exerciseSvgMotion(EXDB[0])).toBe(SVG_EXERCISE_MOTIONS['0001'])
    expect(hasExerciseSvgMotion(EXDB[9])).toBe(true)
    expect(hasExerciseSvgMotion(EXDB[10])).toBe(false)
  })
})
