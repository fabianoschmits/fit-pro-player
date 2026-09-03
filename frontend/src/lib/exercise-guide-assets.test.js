import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import {
  WORKOUT_GUIDE_BY_EXERCISE_ID,
  WORKOUT_GUIDE_EXERCISE_IDS,
  WORKOUT_GUIDE_PNG_SLUGS,
  WORKOUT_GUIDE_SLUGS,
  WORKOUT_GUIDE_VERSION,
  exerciseGuideAsset,
  hasExerciseGuideAsset,
} from './exercise-guide-assets.js'

const pngSlugSet = new Set(WORKOUT_GUIDE_PNG_SLUGS)

describe('local Workout Guide assets', () => {
  it('maps only real catalogue exercises', () => {
    const catalogueIds = new Set(EXDB.map(exercise => exercise.id))
    expect(WORKOUT_GUIDE_EXERCISE_IDS.length).toBeGreaterThanOrEqual(35)
    expect(WORKOUT_GUIDE_SLUGS).toHaveLength(WORKOUT_GUIDE_EXERCISE_IDS.length)
    expect(WORKOUT_GUIDE_EXERCISE_IDS.every(id => catalogueIds.has(id))).toBe(true)
  })

  it('uses custom PNG sprites for every mapped exercise', () => {
    expect(WORKOUT_GUIDE_VERSION).toBe('2.0.0')
    expect(WORKOUT_GUIDE_PNG_SLUGS.length).toBe(WORKOUT_GUIDE_SLUGS.length)
    expect(new Set(WORKOUT_GUIDE_PNG_SLUGS)).toEqual(new Set(WORKOUT_GUIDE_SLUGS))
  })

  it('ships valid PNG frames for every mapped animation', () => {
    for (const slug of WORKOUT_GUIDE_SLUGS) {
      const moduleUrl = new URL(`../assets/workout-guide/${slug}/frames.js`, import.meta.url)
      const moduleDir = dirname(fileURLToPath(moduleUrl))
      expect(existsSync(moduleUrl), slug).toBe(true)
      const source = readFileSync(moduleUrl, 'utf8')
      expect(source, slug).toMatch(/from '\.\/frame-\d+\.png'/)
      const count = (source.match(/from '\.\/frame-\d+\.png'/g) || []).length
      expect(count, slug).toBeGreaterThanOrEqual(2)
      for (let i = 1; i <= count; i++) {
        expect(existsSync(join(moduleDir, `frame-${i}.png`)), `${slug}/frame-${i}.png`).toBe(true)
      }
      const asset = exerciseGuideAsset(EXDB.find(ex => WORKOUT_GUIDE_BY_EXERCISE_ID[ex.id] === slug))
      if (asset) expect(asset.sequence.length, slug).toBe(count)
      expect(pngSlugSet.has(slug), slug).toBe(true)
    }
  })

  it('returns stable animation configuration objects', () => {
    const exercise = EXDB.find(candidate => candidate.id === '3294')
    expect(exerciseGuideAsset(exercise)).toBe(exerciseGuideAsset(exercise))
    expect(exerciseGuideAsset(exercise)).toMatchObject({ duration: 2400, sequence: [0, 1, 2, 3] })
    expect(hasExerciseGuideAsset(exercise)).toBe(true)
    expect(hasExerciseGuideAsset(EXDB.find(candidate => candidate.id === '0001'))).toBe(false)
  })
})
