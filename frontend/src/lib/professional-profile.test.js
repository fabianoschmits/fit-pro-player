import { describe, expect, it, vi } from 'vitest'
import { createProfessionalProfileRepository, normalizeProfessionalProfile } from './professional-profile.js'

describe('professional profile repository', () => {
  it('normalizes bounded professional fields without accepting verification authority', () => {
    const profile = normalizeProfessionalProfile({ professional_name: '  Ana  ', specialties: ['Força', 'força', 'MOBILIDADE'], verification_status: 'verified', bio: 'x'.repeat(2500) })
    expect(profile.professionalName).toBe('Ana')
    expect(profile.specialties).toEqual(['força', 'mobilidade'])
    expect(profile.bio).toHaveLength(2000)
    expect(profile.verificationStatus).toBe('verified')
  })

  it('reads capability and saves only editable fields through the table boundary', async () => {
    const calls = []
    const client = { from: vi.fn(table => {
      calls.push(table)
      if (table === 'user_roles') return { select: () => ({ eq: async () => ({ data: [{ role: 'professional' }], error: null }) }) }
      return { upsert: (row, options) => ({ select: () => ({ single: async () => ({ data: { ...row, verification_status: 'unverified' }, error: null }) }) }) }
    }) }
    const repository = createProfessionalProfileRepository({ client })
    expect(await repository.role('user')).toBe(true)
    const saved = await repository.save('user', { professionalName: 'Ana', verificationStatus: 'verified' })
    expect(saved.verificationStatus).toBe('unverified')
    expect(calls).toEqual(['user_roles', 'professional_profiles'])
  })
})
