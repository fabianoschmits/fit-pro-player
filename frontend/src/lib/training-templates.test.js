import { describe, expect, it } from 'vitest'
import { EXERCISE_SPRITE_EXERCISE_IDS } from './exercise-guide-assets.js'
import { EXDB } from './exercises-data.js'
import { TRAINING_CARDIO_IDS, TRAINING_TEMPLATES, TRAINING_TIMED_IDS } from './training-templates.js'

describe('training candidate catalogue', () => {
  it('uses distinct exercises with checked local animations in every pool', () => {
    const available = new Set(EXERCISE_SPRITE_EXERCISE_IDS)
    for (const [, , ids] of Object.values(TRAINING_TEMPLATES)) {
      expect(ids.length).toBeGreaterThanOrEqual(3)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.every(id => available.has(id))).toBe(true)
    }
  })

  it('keeps machine cardio and timed circuit modes separate', () => {
    const catalogue = new Map(EXDB.map(exercise => [exercise.id, exercise]))
    for (const id of TRAINING_CARDIO_IDS) {
      expect(catalogue.has(id)).toBe(true)
      expect(TRAINING_TIMED_IDS.has(id)).toBe(false)
    }
    expect(TRAINING_CARDIO_IDS.has('0003')).toBe(false)
    expect(catalogue.get('2138').eq).toBe('stationary bike')
  })

  it('names muscle groups explicitly and limits isolated muscle pools', () => {
    expect(TRAINING_TEMPLATES.push[0]).toBe('Chest, Shoulders & Triceps')
    expect(TRAINING_TEMPLATES.pull[0]).toBe('Back, Rear Shoulders & Biceps')
    for (const key of ['biceps', 'triceps', 'forearms', 'calves', 'hamstrings', 'quads']) {
      expect(TRAINING_TEMPLATES[key][2].length).toBeLessThanOrEqual(4)
    }
  })
})
