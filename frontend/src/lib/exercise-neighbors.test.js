import { describe, expect, it } from 'vitest'
import { cycleNeighborIndex, neighborIndexOf } from './exercise-neighbors.js'

describe('exercise neighbors', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('finds the current index in the filtered catalogue', () => {
    expect(neighborIndexOf(list, 'b')).toBe(1)
    expect(neighborIndexOf(list, 'missing')).toBe(0)
  })

  it('wraps forward to the next exercise', () => {
    expect(cycleNeighborIndex(3, 0, 1)).toBe(1)
    expect(cycleNeighborIndex(3, 2, 1)).toBe(0)
  })

  it('wraps backward to the previous exercise', () => {
    expect(cycleNeighborIndex(3, 0, -1)).toBe(2)
    expect(cycleNeighborIndex(1, 0, 1)).toBe(0)
  })
})
