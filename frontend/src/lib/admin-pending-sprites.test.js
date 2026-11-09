import { describe, it, expect } from 'vitest'
import {
  getPendingExercises,
  getExercisePrompt,
  TOTAL_CATALOGUE_EXERCISES,
  ACTIVE_SPRITE_COUNT,
} from './admin-pending-sprites.js'

describe('admin-pending-sprites', () => {
  it('has total catalogue exercises matching 1324', () => {
    expect(TOTAL_CATALOGUE_EXERCISES).toBe(1324)
  })

  it('populates pending exercises with prompt metadata', () => {
    const pending = getPendingExercises()
    expect(pending.length).toBe(TOTAL_CATALOGUE_EXERCISES - ACTIVE_SPRITE_COUNT)

    // Check first item structure
    const first = pending[0]
    expect(first.id).toBeDefined()
    expect(first.namePt).toBeDefined()
    expect(first.hasPrompt).toBe(true)
    expect(first.frameCount).toBeGreaterThan(0)
    expect(typeof first.needsReview).toBe('boolean')
  })

  it('finds special exercise 0755 and retrieves its official prompt', async () => {
    const pending = getPendingExercises()
    const ex0755 = pending.find(e => e.id === '0755')
    expect(ex0755).toBeDefined()
    expect(ex0755.needsReview).toBe(true)
    expect(ex0755.frameCount).toBe(14)

    const promptText = await getExercisePrompt(ex0755)
    expect(promptText).toBeDefined()
    expect(promptText).toContain('EXERCÍCIO 0755 — AGACHAMENTO HACK NO APARELHO SMITH')
    expect(promptText).toContain('SEQUÊNCIA DE 14 FRAMES INDIVIDUAIS')
    expect(promptText).toContain('avatar FPP')
    expect(promptText).toContain('Smith hack squat: a barra permanece sempre nos trilhos verticais')
  })

  it('finds special exercise 3211 with review issue preserved', async () => {
    const pending = getPendingExercises()
    const ex3211 = pending.find(e => e.id === '3211')
    expect(ex3211).toBeDefined()
    expect(ex3211.needsReview).toBe(true)
    expect(ex3211.issues.length).toBeGreaterThan(0)

    const promptText = await getExercisePrompt('3211')
    expect(promptText).toContain('EXERCÍCIO 3211')
  })
})
