import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import PT_EXERCISE_NAMES from '../generated/pt-exercise-names.js'
import { EXDB } from './exercises-data.js'
import {
  EXERCISE_SPRITE_BY_EXERCISE_ID,
  EXERCISE_SPRITE_EXERCISE_IDS,
  EXERCISE_SPRITE_PNG_SLUGS,
  EXERCISE_SPRITE_SLUGS,
  exerciseGuideAsset,
  hasExerciseGuideAsset,
} from './exercise-guide-assets.js'

function frameCountForSlug(slug, source) {
  const count = (source.match(/from '\.\/frame-\d+\.png'/g) || []).length
  expect(count, slug).toBeGreaterThanOrEqual(2)
  return count
}

describe('local PNG exercise assets', () => {
  it('maps only real catalogue exercises with new PNG sprites', () => {
    const catalogueIds = new Set(EXDB.map(exercise => exercise.id))
    expect(EXERCISE_SPRITE_EXERCISE_IDS).toHaveLength(156)
    expect(EXERCISE_SPRITE_SLUGS).toHaveLength(156)
    expect(EXERCISE_SPRITE_PNG_SLUGS).toHaveLength(156)
    expect(EXERCISE_SPRITE_EXERCISE_IDS.every(id => catalogueIds.has(id))).toBe(true)
    expect(new Set(EXERCISE_SPRITE_SLUGS)).toEqual(new Set(EXERCISE_SPRITE_PNG_SLUGS))
  })

  it('uses the exact new movement for mapped exercises and no duplicate catalogue entry', () => {
    expect(EXERCISE_SPRITE_BY_EXERCISE_ID['0003']).toBe('bicycle-crunch')
    expect(EXERCISE_SPRITE_BY_EXERCISE_ID['0006']).toBe('heel-tap')
    expect(EXERCISE_SPRITE_BY_EXERCISE_ID['2355']).toBe('hanging-knee-raise')
    expect(EXERCISE_SPRITE_BY_EXERCISE_ID['3294']).toBe('archer-push-up')
    expect(EXERCISE_SPRITE_BY_EXERCISE_ID['0576']).toBeUndefined()
    expect(EXERCISE_SPRITE_BY_EXERCISE_ID['0577']).toBe('machine-chest-press')

    const activeNames = EXERCISE_SPRITE_EXERCISE_IDS.map(id => PT_EXERCISE_NAMES[id])
    expect(new Set(activeNames).size).toBe(activeNames.length)
    for (const id of ['0001', '0002', '1512', '0007', '1368', '3293']) {
      expect(EXERCISE_SPRITE_BY_EXERCISE_ID[id]).toBeUndefined()
    }
  })

  it('ships only valid PNG frame modules and no legacy sprite directories', () => {
    const guideUrl = new URL('../assets/exercise-sprites/', import.meta.url)
    const guideDir = fileURLToPath(guideUrl)
    const assetDirs = readdirSync(guideDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
    expect(assetDirs).toEqual([...EXERCISE_SPRITE_SLUGS].sort())

    for (const slug of EXERCISE_SPRITE_SLUGS) {
      const moduleUrl = new URL(`../assets/exercise-sprites/${slug}/frames.js`, import.meta.url)
      const moduleDir = dirname(fileURLToPath(moduleUrl))
      expect(existsSync(moduleUrl), slug).toBe(true)
      const source = readFileSync(moduleUrl, 'utf8')
      const count = frameCountForSlug(slug, source)
      expect(source, slug).not.toMatch(/<svg\b|data:image\/svg|dangerouslySetInnerHTML/)
      for (let i = 1; i <= count; i++) {
        expect(existsSync(join(moduleDir, `frame-${i}.png`)), `${slug}/frame-${i}.png`).toBe(true)
      }

      const asset = exerciseGuideAsset(EXDB.find(ex => EXERCISE_SPRITE_BY_EXERCISE_ID[ex.id] === slug))
      expect(asset?.sequence.length, slug).toBe(count)
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

  it('returns stable configurations only for exercises with new sprites', () => {
    const exercise = EXDB.find(candidate => candidate.id === '3294')
    expect(exerciseGuideAsset(exercise)).toBe(exerciseGuideAsset(exercise))
    expect(hasExerciseGuideAsset(exercise)).toBe(true)
    expect(hasExerciseGuideAsset(EXDB.find(candidate => candidate.id === '1326'))).toBe(false)
    expect(hasExerciseGuideAsset(EXDB.find(candidate => candidate.id === '0001'))).toBe(false)
  })
})
