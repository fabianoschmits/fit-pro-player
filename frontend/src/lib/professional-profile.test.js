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

  it('saves normalized editable profile fields through the protected RPC only', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { user_id: 'user', professional_name: 'Ana', bio: 'Sobre', specialties: ['força'], verification_status: 'verified' }, error: null })
    const from = vi.fn(() => { throw new Error('profile editing must not write tables') })
    const repository = createProfessionalProfileRepository({ client: { rpc, from } })

    const saved = await repository.save('user', { professionalName: ' Ana ', bio: ' Sobre ', specialties: [' Força '], verificationStatus: 'unverified' })

    expect(rpc).toHaveBeenCalledWith('save_professional_profile', {
      p_user_id: 'user',
      p_professional_name: 'Ana',
      p_bio: 'Sobre',
      p_specialties: ['força'],
      p_city_region: null,
      p_registration_type: null,
      p_registration_number: null,
    })
    expect(from).not.toHaveBeenCalled()
    expect(saved.verificationStatus).toBe('verified')
  })

  it('maps protected RPC authorization, validation, and missing-profile errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { code: '42501' } })
    const repository = createProfessionalProfileRepository({ client: { rpc } })
    await expect(repository.save('user', { professionalName: 'Ana' })).rejects.toThrow('professional-profile-forbidden')
    rpc.mockResolvedValueOnce({ error: { code: '22023' } })
    await expect(repository.save('user', { professionalName: 'Ana' })).rejects.toThrow('professional-profile-invalid')
    rpc.mockResolvedValueOnce({ error: { code: 'P0002' } })
    await expect(repository.save('user', { professionalName: 'Ana' })).rejects.toThrow('professional-profile-not-found')
  })

  it('provisions a professional account through the protected RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { user_id: 'user', professional_name: 'Ana', verification_status: 'unverified' }, error: null })
    const repository = createProfessionalProfileRepository({ client: { rpc } })

    const profile = await repository.provision('user', { professionalName: 'Ana' })

    expect(profile).toMatchObject({ userId: 'user', professionalName: 'Ana', verificationStatus: 'unverified' })
    expect(rpc).toHaveBeenCalledWith('provision_professional_profile', expect.objectContaining({ p_professional_name: 'Ana' }))
  })
})
