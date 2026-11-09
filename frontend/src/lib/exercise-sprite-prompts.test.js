import { describe, it, expect } from 'vitest'
import {
  getPromptMetadata,
  hasPreparedPrompt,
  getExerciseFullPrompt,
  getExerciseFullData,
  PROMPTS_MINI,
} from './exercise-sprite-prompts.js'

describe('exercise-sprite-prompts', () => {
  it('loads all 1324 exercises in the prompts index', () => {
    expect(Object.keys(PROMPTS_MINI).length).toBe(1324)
  })

  it('correctly loads metadata for special test exercises', () => {
    // 0755 — Agachamento hack no Smith
    const ex0755 = getPromptMetadata('0755')
    expect(ex0755).toBeDefined()
    expect(ex0755.frameCount).toBe(14)
    expect(ex0755.status).toBe('needs_review')
    expect(ex0755.needsReview).toBe(true)
    expect(ex0755.issues.length).toBeGreaterThan(0)

    // 3211 — Flexão com joelhos apoiados
    const ex3211 = getPromptMetadata('3211')
    expect(ex3211).toBeDefined()
    expect(ex3211.frameCount).toBe(14)
    expect(ex3211.status).toBe('needs_review')

    // 1655 — Rosca de bíceps/agachamento com halteres
    const ex1655 = getPromptMetadata('1655')
    expect(ex1655).toBeDefined()
    expect(ex1655.frameCount).toBe(12)
    expect(ex1655.status).toBe('needs_review')

    // 1661 — Rosca de bíceps deitado supino
    const ex1661 = getPromptMetadata('1661')
    expect(ex1661).toBeDefined()
    expect(ex1661.frameCount).toBe(12)

    // 0350 — Rosca deitado supino
    const ex0350 = getPromptMetadata('0350')
    expect(ex0350).toBeDefined()
    expect(ex0350.frameCount).toBe(12)
  })

  it('loads full prepared prompt text asynchronously on demand', async () => {
    const prompt0755 = await getExerciseFullPrompt('0755')
    expect(prompt0755).toContain('EXERCÍCIO 0755')
    expect(prompt0755).toContain('AGACHAMENTO HACK NO APARELHO SMITH')
    expect(prompt0755.length).toBeGreaterThan(500)

    const prompt0001 = await getExerciseFullPrompt('0001')
    expect(prompt0001).toContain('EXERCÍCIO 0001')
    expect(prompt0001).toContain('ABDOMINAL 3/4')
  })

  it('handles non-existent ids gracefully', async () => {
    expect(hasPreparedPrompt('9999')).toBe(false)
    expect(getPromptMetadata('9999')).toBeNull()
    expect(await getExerciseFullPrompt('9999')).toBeNull()
  })
})
