import { describe, expect, it } from 'vitest'
import { ageFromBirthDate, normalizeProfile } from './profile.js'

describe('personal profile', () => {
  it('normalizes legacy body choice into the profile', () => {
    expect(normalizeProfile(null, 'female').sex).toBe('female')
    expect(normalizeProfile({ name: 'Ana', sex: 'female' }, 'male')).toMatchObject({ name: 'Ana', sex: 'female' })
  })

  it('calculates age without crossing the birthday early', () => {
    const now = new Date('2026-09-08T12:00:00')
    expect(ageFromBirthDate('1990-09-08', now)).toBe(36)
    expect(ageFromBirthDate('1990-09-09', now)).toBe(35)
    expect(ageFromBirthDate('2030-01-01', now)).toBeNull()
  })
})
