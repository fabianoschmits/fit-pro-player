export const DEFAULT_PROFILE = {
  name: '',
  birthDate: '',
  sex: 'male',
  heightCm: null,
  startWeight: null,
  goal: '',
  experience: '',
  completedAt: null,
}

export const PROFILE_GOALS = ['lose_weight', 'build_muscle', 'improve_fitness', 'maintain_weight']
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced']

export function normalizeProfile(profile, fallbackBody = 'male') {
  return {
    ...DEFAULT_PROFILE,
    ...(profile && typeof profile === 'object' ? profile : {}),
    sex: profile?.sex === 'female' ? 'female' : profile?.sex === 'male' ? 'male' : fallbackBody === 'female' ? 'female' : 'male',
  }
}

export function ageFromBirthDate(value, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const birth = new Date(value + 'T12:00:00')
  if (Number.isNaN(+birth) || birth > now) return null
  let age = now.getFullYear() - birth.getFullYear()
  const beforeBirthday = now.getMonth() < birth.getMonth()
    || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (beforeBirthday) age--
  return age >= 0 ? age : null
}
