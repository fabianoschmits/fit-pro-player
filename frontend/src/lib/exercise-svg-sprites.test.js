import { describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import {
  EXERCISE_SVG_SPRITES,
  SVG_SPRITE_EXERCISE_IDS,
  exerciseSvgSprite,
  hasExerciseSvgSprite,
} from './exercise-svg-sprites.js'

const FIRST_TEN_IDS = EXDB.slice(0, 10).map(exercise => exercise.id)

describe('exercise SVG sprites', () => {
  it('covers exactly the first ten catalogue exercises', () => {
    expect(SVG_SPRITE_EXERCISE_IDS).toEqual(FIRST_TEN_IDS)
    expect(FIRST_TEN_IDS).toEqual(['0001', '0002', '0003', '1512', '0006', '0007', '1368', '3293', '3294', '2355'])
  })

  it('uses six aligned frames and exercise-specific playback', () => {
    for (const sprite of Object.values(EXERCISE_SVG_SPRITES)) {
      expect(sprite.frameCount).toBe(6)
      expect(sprite.frameWidth).toBe(400)
      expect(sprite.height).toBe(320)
      expect(sprite.sequence.length).toBeGreaterThanOrEqual(6)
      expect(sprite.sequence.every(frame => frame >= 0 && frame < sprite.frameCount)).toBe(true)
      expect(sprite.duration).toBeGreaterThanOrEqual(2200)
      expect(sprite.duration).toBeLessThanOrEqual(6200)
      expect(sprite.loadPaths).toBeTypeOf('function')
    }
  })

  it('loads detailed local vectors with a distinct active-muscle layer', async () => {
    for (const id of FIRST_TEN_IDS) {
      const module = await EXERCISE_SVG_SPRITES[id].loadPaths()
      expect(module.PATHS.length, id).toBeGreaterThan(400)
      expect(module.PATHS.filter(path => path.accentOpacity).length, id).toBeGreaterThan(30)
      expect(module.PATHS.every(path => typeof path.d === 'string' && path.d.length > 0), id).toBe(true)
    }
  })

  it('contains no linked or encoded runtime media', async () => {
    for (const id of FIRST_TEN_IDS) {
      const module = await EXERCISE_SVG_SPRITES[id].loadPaths()
      expect(JSON.stringify(module.PATHS)).not.toMatch(/https?:|data:|\.png|\.jpe?g|\.gif|\.webp/i)
    }
  })

  it('keeps later exercises on the static muscle-map fallback', () => {
    FIRST_TEN_IDS.forEach((id, index) => {
      expect(exerciseSvgSprite(EXDB[index])).toBe(EXERCISE_SVG_SPRITES[id])
      expect(hasExerciseSvgSprite(EXDB[index])).toBe(true)
    })
    expect(hasExerciseSvgSprite(EXDB[10])).toBe(false)
    expect(hasExerciseSvgSprite(EXDB.at(-1))).toBe(false)
  })
})
