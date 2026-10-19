import { describe, expect, it } from 'vitest'
import { formatDisplayMass, fromDisplayMass, toDisplayMass } from './mass.js'

describe('canonical mass conversion', () => {
  it('stores kilograms and converts only at the input/output boundary', () => {
    expect(toDisplayMass(100, 'kg')).toBe(100)
    expect(toDisplayMass(100, 'lb')).toBeCloseTo(220.462262, 6)
    expect(fromDisplayMass(220.462262, 'lb')).toBeCloseTo(100, 5)
  })

  it('does not drift after repeated display-unit switches', () => {
    const storedKg = 83.275
    let current = storedKg
    for (let index = 0; index < 100; index += 1) {
      const shown = toDisplayMass(current, 'lb')
      current = fromDisplayMass(shown, 'lb')
    }
    expect(current).toBeCloseTo(storedKg, 6)
  })

  it('rejects invalid values and formats the requested display unit', () => {
    expect(toDisplayMass('80', 'kg')).toBeNull()
    expect(fromDisplayMass(Number.NaN, 'lb')).toBeNull()
    expect(fromDisplayMass(-1, 'kg')).toBeNull()
    expect(() => toDisplayMass(80, 'stone')).toThrow('invalid-display-unit')
    expect(formatDisplayMass(100, 'lb')).toMatch(/^220[,.]5 lb$/)
    expect(formatDisplayMass(null, 'kg')).toBe('—')
  })
})
