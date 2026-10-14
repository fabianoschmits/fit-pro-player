import { describe, expect, it } from 'vitest'
import { routineBodyView } from './exercise-body-view.js'

describe('routineBodyView', () => {
  it('chooses the front for chest routines', () => {
    expect(routineBodyView({ ex: [{ id: '0025', sets: 4 }] })).toBe('front')
  })

  it('chooses the back for back routines', () => {
    expect(routineBodyView({ ex: [{ id: '0652', sets: 4 }] })).toBe('back')
  })
})
