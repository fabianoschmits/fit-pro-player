import { describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import {
  ABDOMINAL_SPRITE_FRAME_WIDTH,
  ABDOMINAL_SPRITE_HEIGHT,
  ABDOMINAL_SPRITE_PATHS,
} from './abdominal-sprite-paths.js'
import {
  EXERCISE_SVG_SPRITES,
  SVG_SPRITE_EXERCISE_IDS,
  exerciseSvgSprite,
  hasExerciseSvgSprite,
} from './exercise-svg-sprites.js'

describe('exercise SVG sprite prototype', () => {
  it('is deliberately limited to the first catalogue exercise', () => {
    expect(SVG_SPRITE_EXERCISE_IDS).toEqual([EXDB[0].id])
    expect(EXDB[0].id).toBe('0001')
  })

  it('uses one six-frame vector sheet in a forward and reverse sequence', () => {
    const sprite = EXERCISE_SVG_SPRITES['0001']
    expect(sprite.frameCount).toBe(6)
    expect(sprite.frameWidth).toBe(ABDOMINAL_SPRITE_FRAME_WIDTH)
    expect(sprite.height).toBe(ABDOMINAL_SPRITE_HEIGHT)
    expect(sprite.sequence).toEqual([0, 0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1])
    expect(sprite.posterFrame).toBe(5)
    expect(sprite.duration).toBeGreaterThanOrEqual(3500)
    expect(sprite.duration).toBeLessThanOrEqual(5000)
  })

  it('keeps detailed local vectors and a distinct active-muscle layer', () => {
    expect(ABDOMINAL_SPRITE_PATHS.length).toBeGreaterThan(800)
    expect(ABDOMINAL_SPRITE_PATHS.filter(path => path.accentOpacity).length).toBeGreaterThan(70)
    expect(ABDOMINAL_SPRITE_PATHS.every(path => typeof path.d === 'string' && path.d.length > 0)).toBe(true)
  })

  it('contains no linked or encoded media', () => {
    const source = JSON.stringify(EXERCISE_SVG_SPRITES)
    expect(source).not.toMatch(/https?:|data:|\.png|\.jpe?g|\.gif|\.webp/i)
  })

  it('keeps every other exercise on the existing fallback', () => {
    expect(exerciseSvgSprite(EXDB[0])).toBe(EXERCISE_SVG_SPRITES['0001'])
    expect(hasExerciseSvgSprite(EXDB[0])).toBe(true)
    expect(hasExerciseSvgSprite(EXDB[1])).toBe(false)
    expect(hasExerciseSvgSprite(EXDB[9])).toBe(false)
  })
})
