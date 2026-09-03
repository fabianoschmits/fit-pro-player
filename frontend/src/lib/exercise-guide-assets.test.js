import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import {
  WORKOUT_GUIDE_COMMIT,
  WORKOUT_GUIDE_BY_EXERCISE_ID,
  WORKOUT_GUIDE_EXERCISE_IDS,
  WORKOUT_GUIDE_PNG_SLUGS,
  WORKOUT_GUIDE_SLUGS,
  WORKOUT_GUIDE_VERSION,
  exerciseGuideAsset,
  hasExerciseGuideAsset,
} from './exercise-guide-assets.js'

const pngSlugSet = new Set(WORKOUT_GUIDE_PNG_SLUGS)

function frameCountForSlug(slug, source) {
  if (pngSlugSet.has(slug)) {
    return (source.match(/from '\.\/frame-\d+\.png'/g) || []).length
  }
  const literal = source.match(/Object\.freeze\((\[[\s\S]*\])\)\s*\nexport default/)?.[1]
  expect(literal, slug).toBeTruthy()
  return JSON.parse(literal).length
}

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

  it('ships valid SVG or PNG frames for every mapped animation', () => {
    for (const slug of WORKOUT_GUIDE_SLUGS) {
      const moduleUrl = new URL(`../assets/workout-guide/${slug}/frames.js`, import.meta.url)
      const moduleDir = dirname(fileURLToPath(moduleUrl))
      expect(existsSync(moduleUrl), slug).toBe(true)
      const source = readFileSync(moduleUrl, 'utf8')
      const count = frameCountForSlug(slug, source)
      expect(count, slug).toBeGreaterThanOrEqual(2)

      if (pngSlugSet.has(slug)) {
        expect(source, slug).toMatch(/from '\.\/frame-\d+\.png'/)
        for (let i = 1; i <= count; i++) {
          expect(existsSync(join(moduleDir, `frame-${i}.png`)), `${slug}/frame-${i}.png`).toBe(true)
        }
      } else {
        const literal = source.match(/Object\.freeze\((\[[\s\S]*\])\)\s*\nexport default/)?.[1]
        const frames = JSON.parse(literal)
        expect(new Set(frames).size, `${slug}: unique SVG frames`).toBeGreaterThanOrEqual(2)
        for (const [index, frame] of frames.entries()) {
          expect(frame, `${slug}: frame ${index + 1} canvas`).toMatch(
            /^<svg\b[^>]*\bwidth="512"[^>]*\bheight="512"[^>]*\bviewBox="0 0 512 512"/i,
          )
        }
        expect(source, slug).not.toMatch(/<(?:script|foreignObject)\b|\bjavascript:/i)
      }

      const asset = exerciseGuideAsset(EXDB.find(ex => WORKOUT_GUIDE_BY_EXERCISE_ID[ex.id] === slug))
      if (asset) expect(asset.sequence.length, slug).toBe(count)
    }
  })

  it('keeps the embedded animation directory in the Vercel build context', () => {
    const ignoreUrl = new URL('../../../.vercelignore', import.meta.url)
    const rules = readFileSync(ignoreUrl, 'utf8')
      .split(/\r?\n/)
      .map(rule => rule.trim())
      .filter(rule => rule && !rule.startsWith('#'))
    expect(rules).toContain('/assets/')
    expect(rules).not.toContain('assets/')
    expect(rules).not.toContain('frontend/src/assets/')
    expect(rules).not.toContain('frontend/src/assets/**')
  })

  it('returns stable animation configuration objects', () => {
    expect(WORKOUT_GUIDE_VERSION).toBe('1.0.0')
    expect(WORKOUT_GUIDE_COMMIT).toBe('ba0b709cb20430361b2cb33aaadd20998164a916')
    const exercise = EXDB.find(candidate => candidate.id === '3294')
    expect(exerciseGuideAsset(exercise)).toBe(exerciseGuideAsset(exercise))
    expect(hasExerciseGuideAsset(exercise)).toBe(true)
    expect(hasExerciseGuideAsset(EXDB.find(candidate => candidate.id === '0001'))).toBe(false)
  })
})
