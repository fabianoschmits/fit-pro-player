import { describe, expect, it } from 'vitest'
import {
  ageFromBirthDate, dateFromParts, dateParts, daysInMonth, decimalNumber,
  currentProfileWeight,
  defaultBirthDate, formatPersonName, heightCmFromText, heightInput, heightText,
  latestBodyWeight, normalizeProfile, syncProfileWeightFromBodyweight, weightInput, weightText,
} from './profile.js'
import { AVATARS, DEFAULT_AVATAR_ID } from './avatars.js'

describe('personal profile', () => {
  it('normalizes legacy body choice into the profile', () => {
    expect(normalizeProfile(null, 'female').sex).toBe('female')
    expect(normalizeProfile({ name: 'Ana', sex: 'female' }, 'male')).toMatchObject({ name: 'Ana', sex: 'female' })
    expect(normalizeProfile({ avatarId: 'missing-avatar' }).avatarId).toBe(DEFAULT_AVATAR_ID)
  })

  it('provides the complete avatar collection with stable unique ids', () => {
    expect(AVATARS).toHaveLength(80)
    expect(new Set(AVATARS.map(avatar => avatar.id)).size).toBe(80)
    expect(AVATARS.some(avatar => avatar.id === DEFAULT_AVATAR_ID)).toBe(true)
  })

  it('calculates age without crossing the birthday early', () => {
    const now = new Date('2026-09-08T12:00:00')
    expect(ageFromBirthDate('1990-09-08', now)).toBe(36)
    expect(ageFromBirthDate('1990-09-09', now)).toBe(35)
    expect(ageFromBirthDate('2030-01-01', now)).toBeNull()
  })

  it('formats names while preserving lowercase connectors', () => {
    expect(formatPersonName('ana maria da silva e souza')).toBe('Ana Maria da Silva e Souza')
    expect(formatPersonName("  joÃO d'ávila  de  castro")).toBe("João D'Ávila de Castro")
    expect(formatPersonName('luiz-carlos dos santos')).toBe('Luiz-Carlos dos Santos')
  })

  it('accepts localized height and weight input', () => {
    expect(heightInput('1.76m')).toBe('1,76')
    expect(weightInput('71,25kg')).toBe('71,2')
    expect(decimalNumber('71,2')).toBe(71.2)
    expect(heightCmFromText('1,76')).toBe(176)
    expect(heightText(176)).toBe('1,76')
    expect(weightText(71.2)).toBe('71,2')
  })

  it('treats the newest weigh-in as the user current weight', () => {
    const state = {
      body: 'male',
      profile: { startWeight: 70 },
      bodyweight: [
        { d: '2026-09-08', w: 81.2, t: 2 },
        { d: '2026-09-09', w: 80.7, t: 1 },
      ],
    }

    expect(latestBodyWeight(state.bodyweight).w).toBe(80.7)
    expect(currentProfileWeight(state)).toBe(80.7)

    syncProfileWeightFromBodyweight(state)
    expect(state.profile.startWeight).toBe(80.7)
  })

  it('builds safe wheel dates and clamps impossible days', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2025, 2)).toBe(28)
    expect(dateFromParts({ year: 2025, month: 2, day: 31 })).toBe('2025-02-28')
    expect(dateParts('1990-09-08')).toEqual({ year: 1990, month: 9, day: 8 })
    expect(defaultBirthDate(new Date('2026-09-08T12:00:00'))).toBe('2001-09-08')
  })
})
