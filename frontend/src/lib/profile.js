import { DEFAULT_AVATAR_ID, isAvatarId } from './avatars.js'

export const DEFAULT_PROFILE = {
  name: '',
  avatarId: DEFAULT_AVATAR_ID,
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

export const PROFILE_GOAL_LABELS = {
  lose_weight: 'Lose weight',
  build_muscle: 'Build muscle',
  improve_fitness: 'Improve fitness',
  maintain_weight: 'Maintain weight',
}

export const EXPERIENCE_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const NAME_CONNECTORS = new Set([
  'a', 'as', 'da', 'das', 'de', 'do', 'dos', 'e',
  'del', 'della', 'di', 'du', 'la', 'le', 'van', 'von',
])

const titleToken = token => token
  .toLocaleLowerCase('pt-BR')
  .replace(/(^|[-'])\p{L}/gu, letter => letter.toLocaleUpperCase('pt-BR'))

/** Capitalize a person's names and surnames while keeping common connectors lowercase. */
export function formatPersonName(value) {
  const compact = String(value || '').replace(/^\s+/, '').replace(/\s+/g, ' ')
  return compact.split(' ').map((token, index) => {
    if (!token) return token
    const lower = token.toLocaleLowerCase('pt-BR')
    return index > 0 && NAME_CONNECTORS.has(lower) ? lower : titleToken(token)
  }).join(' ')
}

/** Keep a decimal field pleasant to type: comma separator and a bounded precision. */
export function decimalInput(value, integerDigits = 3, decimalDigits = 1) {
  const normalized = String(value ?? '').replace('.', ',').replace(/[^\d,]/g, '')
  const [integer = '', ...fractions] = normalized.split(',')
  const whole = integer.slice(0, integerDigits)
  if (!fractions.length) return whole
  return `${whole || '0'},${fractions.join('').slice(0, decimalDigits)}`
}

export function decimalNumber(value) {
  const number = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(number) && number > 0 ? number : null
}

export const weightInput = value => decimalInput(value, 3, 1)
export const heightInput = value => decimalInput(value, 1, 2)
export const weightText = value => value > 0 ? String(Math.round(value * 10) / 10).replace('.', ',') : ''
export const heightText = heightCm => heightCm > 0 ? (heightCm / 100).toFixed(2).replace('.', ',') : ''
export const heightCmFromText = value => {
  const meters = decimalNumber(value)
  return meters ? Math.round(meters * 100) : null
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

export function dateParts(value, fallback = defaultBirthDate()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '') || /^(\d{4})-(\d{2})-(\d{2})$/.exec(fallback)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

export function dateFromParts({ year, month, day }) {
  const safeYear = Math.max(1900, Number(year) || 2000)
  const safeMonth = Math.max(1, Math.min(12, Number(month) || 1))
  const safeDay = Math.min(Math.max(1, Number(day) || 1), daysInMonth(safeYear, safeMonth))
  return `${safeYear}-${String(safeMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

export function defaultBirthDate(now = new Date()) {
  return dateFromParts({ year: now.getFullYear() - 25, month: now.getMonth() + 1, day: now.getDate() })
}

export function normalizeProfile(profile, fallbackBody = 'male') {
  return {
    ...DEFAULT_PROFILE,
    ...(profile && typeof profile === 'object' ? profile : {}),
    name: formatPersonName(profile?.name || ''),
    avatarId: isAvatarId(profile?.avatarId) ? profile.avatarId : DEFAULT_AVATAR_ID,
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
