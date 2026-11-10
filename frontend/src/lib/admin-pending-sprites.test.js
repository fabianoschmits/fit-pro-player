import { describe, it, expect } from 'vitest'
import {
  getPendingExercises,
  getRemainingBacklogExercises,
  getExercisePrompt,
  TOTAL_CATALOGUE_EXERCISES,
  ACTIVE_SPRITE_COUNT,
  TOTAL_PRIORITY_QUEUE_EXERCISES,
  SPRITE_PRIORITY_QUEUE_IDS,
  SPRITE_PRIORITY_QUEUE_SET,
} from './admin-pending-sprites.js'
import { EXDB } from './exercises-data.js'
import { getPromptMetadata, getExerciseFullPrompt } from './exercise-sprite-prompts.js'

describe('admin-pending-sprites & priority queue', () => {
  it('preserves the original catalogue with all 1324 exercises', () => {
    expect(EXDB.length).toBe(1324)
    expect(TOTAL_CATALOGUE_EXERCISES).toBe(1324)
  })

  it('validates whitelist has exactly 100 unique IDs, all in catalogue, none with active sprite', () => {
    expect(SPRITE_PRIORITY_QUEUE_IDS.length).toBe(100)
    expect(SPRITE_PRIORITY_QUEUE_SET.size).toBe(100)
    expect(TOTAL_PRIORITY_QUEUE_EXERCISES).toBe(100)

    const catIdSet = new Set(EXDB.map(e => e.id))
    for (const id of SPRITE_PRIORITY_QUEUE_IDS) {
      expect(catIdSet.has(id)).toBe(true)
    }
  })

  it('returns exclusively the prioritized 100 exercises that lack sprites in getPendingExercises()', () => {
    const pending = getPendingExercises()
    expect(pending.length).toBe(100)

    const pendingIds = pending.map(e => e.id)
    expect(pendingIds).toEqual([...SPRITE_PRIORITY_QUEUE_IDS])

    // Never includes any of the other 1,068 exercises outside the whitelist
    const nonPrioritizedIds = EXDB.map(e => e.id).filter(id => !SPRITE_PRIORITY_QUEUE_SET.has(id))
    expect(nonPrioritizedIds.length).toBe(1324 - 100)

    for (const item of pending) {
      expect(SPRITE_PRIORITY_QUEUE_SET.has(item.id)).toBe(true)
      expect(item.hasPrompt).toBe(true)
      expect(item.frameCount).toBeGreaterThan(0)
    }
  })

  it('never leaks exercises outside whitelist into pending queue', () => {
    const pending = getPendingExercises()
    const pendingIdSet = new Set(pending.map(e => e.id))

    // Check sample non-prioritized exercises (like 0001, 0002, 3211)
    expect(pendingIdSet.has('0001')).toBe(false)
    expect(pendingIdSet.has('0002')).toBe(false)
    expect(pendingIdSet.has('3211')).toBe(false)
  })

  it('preserves prompt access for non-prioritized exercises even when hidden from admin queue', async () => {
    // 3211 is in the general catalogue (1.324), not in 100 priority queue
    const meta3211 = getPromptMetadata('3211')
    expect(meta3211).toBeDefined()
    expect(meta3211.needsReview).toBe(true)

    const prompt3211 = await getExerciseFullPrompt('3211')
    expect(prompt3211).toBeDefined()
    expect(prompt3211).toContain('EXERCÍCIO 3211')
  })

  it('correctly tracks review notices on prioritized exercises', async () => {
    const pending = getPendingExercises()

    // 0755 — Agachamento Hack no Smith
    const ex0755 = pending.find(e => e.id === '0755')
    expect(ex0755).toBeDefined()
    expect(ex0755.needsReview).toBe(true)
    expect(ex0755.issues.length).toBeGreaterThan(0)

    const prompt0755 = await getExercisePrompt(ex0755)
    expect(prompt0755).toContain('EXERCÍCIO 0755')
    expect(prompt0755).toContain('Smith hack squat: a barra permanece sempre nos trilhos verticais')

    // 0602 — Crucifixo inverso na máquina
    const ex0602 = pending.find(e => e.id === '0602')
    expect(ex0602).toBeDefined()
    expect(ex0602.needsReview).toBe(true)

    // 0599 — Flexora sentada
    const ex0599 = pending.find(e => e.id === '0599')
    expect(ex0599).toBeDefined()
    expect(ex0599.needsReview).toBe(true)

    // 0598 — Adutora sentada
    const ex0598 = pending.find(e => e.id === '0598')
    expect(ex0598).toBeDefined()
    expect(ex0598.needsReview).toBe(true)

    // 1761 — Elevação oblíqua de joelhos suspenso
    const ex1761 = pending.find(e => e.id === '1761')
    expect(ex1761).toBeDefined()
    expect(ex1761.needsReview).toBe(true)

    // 3361 — Skater Hops
    const ex3361 = pending.find(e => e.id === '3361')
    expect(ex3361).toBeDefined()
    expect(ex3361.needsReview).toBe(true)

    // 0423 — Extensão unilateral de tríceps em pé
    const ex0423 = pending.find(e => e.id === '0423')
    expect(ex0423).toBeDefined()
    expect(ex0423.needsReview).toBe(true)

    // 1735 — Extensão unilateral de tríceps deitado
    const ex1735 = pending.find(e => e.id === '1735')
    expect(ex1735).toBeDefined()
    expect(ex1735.needsReview).toBe(true)
  })

  it('returns all remaining 1068 exercises in the secondary backlog sorted by relevance', () => {
    const backlog = getRemainingBacklogExercises()
    expect(backlog.length).toBe(TOTAL_CATALOGUE_EXERCISES - ACTIVE_SPRITE_COUNT - TOTAL_PRIORITY_QUEUE_EXERCISES)
    expect(backlog.length).toBe(1068)

    // Ensure none of the priority 100 exercises leak into the secondary backlog
    for (const item of backlog) {
      expect(SPRITE_PRIORITY_QUEUE_SET.has(item.id)).toBe(false)
      expect(item.hasPrompt).toBe(true)
      expect(typeof item.score).toBe('number')
    }

    // Verify sorting by score descending
    for (let i = 0; i < backlog.length - 1; i++) {
      expect(backlog[i].score).toBeGreaterThanOrEqual(backlog[i + 1].score)
    }
  })

  it('keeps active sprites count intact (156 sprites activos)', () => {
    expect(ACTIVE_SPRITE_COUNT).toBe(156)
  })
})
