import { describe, expect, it } from 'vitest'
import { exerciseBodyView } from '../lib/exercise-body-view.js'

describe('exerciseBodyView', () => {
  it('uses the front avatar for anterior targets', () => {
    expect(exerciseBodyView({ tg: 'pectorals', bp: 'chest' })).toBe('front')
    expect(exerciseBodyView({ tg: 'quads', bp: 'upper legs' })).toBe('front')
    expect(exerciseBodyView({ tg: 'biceps', bp: 'upper arms' })).toBe('front')
  })

  it('uses the back avatar for posterior targets', () => {
    expect(exerciseBodyView({ tg: 'lats', bp: 'back' })).toBe('back')
    expect(exerciseBodyView({ tg: 'glutes', bp: 'upper legs' })).toBe('back')
    expect(exerciseBodyView({ tg: 'hamstrings', bp: 'upper legs' })).toBe('back')
    expect(exerciseBodyView({ n: 'cable rear delt fly', tg: 'delts', bp: 'shoulders' })).toBe('back')
  })

  it('uses the body-part fallback when no canonical muscle is available', () => {
    expect(exerciseBodyView({ tg: 'cardiovascular system', bp: 'cardio' })).toBe('front')
    expect(exerciseBodyView({ tg: 'unknown', bp: 'back' })).toBe('back')
  })
})
