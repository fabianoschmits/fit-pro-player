const MAX = Object.freeze({ name: 120, bio: 2000, specialty: 40, city: 120, type: 40, number: 80 })

const stringOrNull = value => typeof value === 'string' && value.trim() ? value.trim() : null

export function normalizeProfessionalProfile(input = {}) {
  const specialties = Array.isArray(input.specialties)
    ? [...new Set(input.specialties.map(value => String(value).trim().toLowerCase()).filter(Boolean))].slice(0, 8)
    : []
  return {
    userId: input.user_id || input.userId || null,
    professionalName: String(input.professional_name || input.professionalName || '').trim().slice(0, MAX.name),
    bio: stringOrNull(input.bio)?.slice(0, MAX.bio) || null,
    specialties: specialties.map(value => value.slice(0, MAX.specialty)),
    cityRegion: stringOrNull(input.city_region || input.cityRegion)?.slice(0, MAX.city) || null,
    registrationType: stringOrNull(input.registration_type || input.registrationType)?.slice(0, MAX.type) || null,
    registrationNumber: stringOrNull(input.registration_number || input.registrationNumber)?.slice(0, MAX.number) || null,
    verificationStatus: input.verification_status || input.verificationStatus || 'unverified',
    createdAt: input.created_at || input.createdAt || null,
    updatedAt: input.updated_at || input.updatedAt || null,
  }
}

function rowFromProfile(profile, userId) {
  const normalized = normalizeProfessionalProfile(profile)
  return {
    user_id: userId,
    professional_name: normalized.professionalName,
    bio: normalized.bio,
    specialties: normalized.specialties,
    city_region: normalized.cityRegion,
    registration_type: normalized.registrationType,
    registration_number: normalized.registrationNumber,
  }
}

export function createProfessionalProfileRepository({ client } = {}) {
  const requireClient = () => {
    if (!client?.from) throw new Error('supabase-unavailable')
    return client
  }
  const requireRpc = () => {
    if (!client?.rpc) throw new Error('supabase-unavailable')
    return client
  }
  const own = async userId => {
    const response = await requireClient().from('professional_profiles').select('*').eq('user_id', userId).maybeSingle()
    if (response?.error) throw new Error('professional-profile-read-failed')
    return response.data ? normalizeProfessionalProfile(response.data) : null
  }
  const role = async userId => {
    const response = await requireClient().from('user_roles').select('role').eq('user_id', userId)
    if (response?.error) throw new Error('professional-role-read-failed')
    return (response.data || []).some(item => item.role === 'professional')
  }
  const save = async (userId, profile) => {
    const row = rowFromProfile(profile, userId)
    if (!row.professional_name) throw new Error('professional-name-required')
    const response = await requireClient().from('professional_profiles').upsert(row, { onConflict: 'user_id' }).select('*').single()
    if (response?.error) throw new Error(response.error.code === '42501' ? 'professional-profile-forbidden' : 'professional-profile-save-failed')
    return normalizeProfessionalProfile(response.data)
  }
  const provision = async (userId, profile) => {
    const normalized = normalizeProfessionalProfile({ ...profile, user_id: userId })
    if (!normalized.professionalName) throw new Error('professional-name-required')
    const response = await requireRpc().rpc('provision_professional_profile', {
      p_professional_name: normalized.professionalName,
      p_bio: normalized.bio,
      p_specialties: normalized.specialties,
      p_city_region: normalized.cityRegion,
      p_registration_type: normalized.registrationType,
      p_registration_number: normalized.registrationNumber,
    })
    if (response?.error) throw new Error('professional-profile-provision-failed')
    return normalizeProfessionalProfile(response.data)
  }
  return Object.freeze({ own, role, save, provision })
}
