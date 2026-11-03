import { composeCityRegion } from './brazil-locations.js'
import { MAX_PROFESSIONAL_SPECIALTIES, MAX_SPECIALTY_LENGTH, normalizeSpecialtyValue } from './professional-specialties.js'

const MAX = Object.freeze({ name: 120, bio: 2000, specialty: MAX_SPECIALTY_LENGTH, city: 200, cityName: 80, neighborhood: 80, type: 40, number: 80 })

const stringOrNull = value => typeof value === 'string' && value.trim() ? value.trim() : null

export function normalizeProfessionalProfile(input = {}) {
  const specialties = Array.isArray(input.specialties)
    ? [...new Set(input.specialties.map(normalizeSpecialtyValue).filter(Boolean))].slice(0, MAX_PROFESSIONAL_SPECIALTIES)
    : []
  const stateUf = stringOrNull(input.state_uf || input.stateUf)?.toUpperCase().slice(0, 2) || null
  const cityName = stringOrNull(input.city_name || input.cityName)?.slice(0, MAX.cityName) || null
  const neighborhood = stringOrNull(input.neighborhood)?.slice(0, MAX.neighborhood) || null
  return {
    userId: input.user_id || input.userId || null,
    professionalName: String(input.professional_name || input.professionalName || '').trim().slice(0, MAX.name),
    bio: stringOrNull(input.bio)?.slice(0, MAX.bio) || null,
    specialties: specialties.map(value => value.slice(0, MAX.specialty)),
    cityRegion: stringOrNull(input.city_region || input.cityRegion)?.slice(0, MAX.city) || composeCityRegion({ neighborhood, cityName, stateUf }),
    stateUf,
    cityName,
    neighborhood,
    registrationType: stringOrNull(input.registration_type || input.registrationType)?.slice(0, MAX.type) || null,
    registrationNumber: stringOrNull(input.registration_number || input.registrationNumber)?.slice(0, MAX.number) || null,
    verificationStatus: input.verification_status || input.verificationStatus || 'unverified',
    createdAt: input.created_at || input.createdAt || null,
    updatedAt: input.updated_at || input.updatedAt || null,
  }
}

export function professionalProfileMetadata(profile) {
  const normalized = normalizeProfessionalProfile(profile)
  return {
    professional_name: normalized.professionalName || null,
    bio: normalized.bio,
    specialties: normalized.specialties,
    city_region: normalized.cityRegion,
    state_uf: normalized.stateUf,
    city_name: normalized.cityName,
    neighborhood: normalized.neighborhood,
    registration_type: normalized.registrationType,
    registration_number: normalized.registrationNumber,
  }
}

function rowFromProfile(profile) {
  const normalized = normalizeProfessionalProfile(profile)
  const cityRegion = normalized.cityRegion || composeCityRegion(normalized)
  return {
    professional_name: normalized.professionalName,
    bio: normalized.bio,
    specialties: normalized.specialties,
    city_region: cityRegion,
    registration_type: normalized.registrationType,
    registration_number: normalized.registrationNumber,
    state_uf: normalized.stateUf,
    city_name: normalized.cityName,
    neighborhood: normalized.neighborhood,
  }
}

const profileSaveError = code => code === '42501' ? 'professional-profile-forbidden'
  : code === '22023' ? 'professional-profile-invalid'
    : code === 'P0002' ? 'professional-profile-not-found'
      : 'professional-profile-save-failed'

export function createProfessionalProfileRepository({ client = undefined } = {}) {
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
    const row = rowFromProfile(profile)
    if (!row.professional_name) throw new Error('professional-name-required')
    const response = await requireRpc().rpc('save_professional_profile', { p_user_id: userId, ...Object.fromEntries(Object.entries(row).map(([key, value]) => [`p_${key}`, value])) })
    if (response?.error) throw new Error(profileSaveError(response.error.code))
    return normalizeProfessionalProfile(response.data)
  }
  const provision = async (userId, profile) => {
    const normalized = normalizeProfessionalProfile({ ...profile, user_id: userId })
    if (!normalized.professionalName) throw new Error('professional-name-required')
    const response = await requireRpc().rpc('provision_professional_profile', {
      p_professional_name: normalized.professionalName,
      p_bio: normalized.bio,
      p_specialties: normalized.specialties,
      p_city_region: normalized.cityRegion || composeCityRegion(normalized),
      p_registration_type: normalized.registrationType,
      p_registration_number: normalized.registrationNumber,
      p_state_uf: normalized.stateUf,
      p_city_name: normalized.cityName,
      p_neighborhood: normalized.neighborhood,
    })
    if (response?.error) throw new Error('professional-profile-provision-failed')
    return normalizeProfessionalProfile(response.data)
  }
  return Object.freeze({ own, role, save, provision })
}
