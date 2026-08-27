import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import {
  WORKOUT_GUIDE_COMMIT,
  WORKOUT_GUIDE_BY_EXERCISE_ID,
  WORKOUT_GUIDE_EXERCISE_IDS,
  WORKOUT_GUIDE_SLUGS,
  WORKOUT_GUIDE_VERSION,
  exerciseGuideAsset,
  hasExerciseGuideAsset,
} from './exercise-guide-assets.js'

describe('local Workout Guide assets', () => {
  it('maps only real catalogue exercises', () => {
    const catalogueIds = new Set(EXDB.map(exercise => exercise.id))
    expect(WORKOUT_GUIDE_EXERCISE_IDS).toHaveLength(173)
    expect(WORKOUT_GUIDE_SLUGS).toHaveLength(172)
    expect(WORKOUT_GUIDE_EXERCISE_IDS.every(id => catalogueIds.has(id))).toBe(true)
  })

  it('uses the exact new movement for mapped exercises and no old first-ten substitute', () => {
    expect(WORKOUT_GUIDE_BY_EXERCISE_ID['0003']).toBe('bicycle-crunch')
    expect(WORKOUT_GUIDE_BY_EXERCISE_ID['0006']).toBe('heel-tap')
    expect(WORKOUT_GUIDE_BY_EXERCISE_ID['2355']).toBe('hanging-knee-raise')
    expect(WORKOUT_GUIDE_BY_EXERCISE_ID['3294']).toBe('archer-push-up')
    for (const id of ['0001', '0002', '1512', '0007', '1368', '3293']) {
      expect(WORKOUT_GUIDE_BY_EXERCISE_ID[id]).toBeUndefined()
    }
  })

  it('ships three inline SVG frames for every mapped animation', () => {
    for (const slug of WORKOUT_GUIDE_SLUGS) {
      const moduleUrl = new URL(`../assets/workout-guide/${slug}/frames.js`, import.meta.url)
      expect(existsSync(moduleUrl), slug).toBe(true)
      const source = readFileSync(moduleUrl, 'utf8')
      expect((source.match(/<svg\b/g) || []).length, slug).toBe(3)
      expect(source, slug).not.toMatch(/<(?:script|image|foreignObject)\b|\b(?:href|xlink:href)\s*=|javascript:/i)
    }
  })

  it('preserves exact source provenance for the bundled subset', () => {
    const provenanceUrl = new URL('../assets/workout-guide/manifest.json', import.meta.url)
    const provenance = JSON.parse(readFileSync(provenanceUrl, 'utf8'))
    expect(provenance.sourceCommit).toBe(WORKOUT_GUIDE_COMMIT)
    expect(provenance.sourceVersion).toBe(WORKOUT_GUIDE_VERSION)
    expect(provenance.assetLicense).toBe('CC BY-SA 4.0')
    expect(provenance.importedExerciseCount).toBe(WORKOUT_GUIDE_SLUGS.length)
    expect(provenance.importedFrameCount).toBe(WORKOUT_GUIDE_SLUGS.length * 3)
    expect(provenance.exercises.map(exercise => exercise.slug)).toEqual(WORKOUT_GUIDE_SLUGS)
  })

  it('returns stable animation configuration objects', () => {
    const exercise = EXDB.find(candidate => candidate.id === '0003')
    expect(exerciseGuideAsset(exercise)).toBe(exerciseGuideAsset(exercise))
    expect(hasExerciseGuideAsset(exercise)).toBe(true)
    expect(hasExerciseGuideAsset(EXDB.find(candidate => candidate.id === '0001'))).toBe(false)
  })
})
