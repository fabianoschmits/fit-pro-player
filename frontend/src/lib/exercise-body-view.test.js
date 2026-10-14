import { describe, expect, it } from 'vitest'
import { exerciseBodyRegion, routineBodyRegion, routineBodyView } from './exercise-body-view.js'

describe('routineBodyView', () => {
  it('chooses the front for chest routines', () => {
    expect(routineBodyView({ ex: [{ id: '0025', sets: 4 }] })).toBe('front')
  })

  it('chooses the back for back routines', () => {
    expect(routineBodyView({ ex: [{ id: '0652', sets: 4 }] })).toBe('back')
  })
})

describe('routineBodyRegion', () => {
  it('chooses upper for an upper-body routine', () => {
    expect(routineBodyRegion({ ex: [{ muscleWeights: { chest: 1, deltoids: 1 } }] })).toBe('upper')
  })

  it('chooses lower for a leg routine', () => {
    expect(routineBodyRegion({ ex: [{ muscleWeights: { quadriceps: 1, hamstring: 1, calves: 1 } }] })).toBe('lower')
  })

  it('keeps a balanced routine full body', () => {
    expect(routineBodyRegion({ ex: [{ muscleWeights: { chest: 1, quadriceps: 1 } }] })).toBe('full')
  })
})

describe('exerciseBodyRegion', () => {
  it('uses the focused upper region for a chest exercise', () => {
    expect(exerciseBodyRegion({ muscleWeights: { chest: 1, deltoids: .4 } })).toBe('upper')
  })

  it('uses the focused lower region for a leg exercise', () => {
    expect(exerciseBodyRegion({ muscleWeights: { quadriceps: 1, hamstring: .3 } })).toBe('lower')
  })
})
