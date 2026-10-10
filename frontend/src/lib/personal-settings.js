import { EXPERIENCE_LEVELS, PROFILE_GOALS, currentProfileWeight, decimalNumber, formatPersonName, heightCmFromText, heightText, normalizeProfile, weightText } from './profile.js'

export function personalSettingsDraft(state) {
  const profile = normalizeProfile(state.profile, state.body)
  return { ...profile, height: heightText(profile.heightCm), weight: weightText(currentProfileWeight(state)), targetWeight: weightText(state.targetW), unit: state.unit === 'lb' ? 'lb' : 'kg' }
}

export function applyPersonalSettings(state, draft, baseline, { today, now = Date.now() }) {
  if ((state.unit === 'lb' ? 'lb' : 'kg') !== baseline.unit) throw new Error('settings-context-changed')
  const name = formatPersonName(draft.name).trim()
  if (name.length < 2 || name.length > 50) throw new Error('name')
  const birth = new Date(`${draft.birthDate}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate || '') || Number.isNaN(+birth) || birth.toISOString().slice(0, 10) !== draft.birthDate || draft.birthDate < '1900-01-01' || draft.birthDate > today) throw new Error('birthDate')
  const heightCm = heightCmFromText(draft.height)
  if (!heightCm || heightCm < 100 || heightCm > 250) throw new Error('height')
  const weight = decimalNumber(draft.weight)
  if (!(weight > 0) || !Number.isFinite(weight)) throw new Error('weight')
  const target = draft.targetWeight.trim() ? decimalNumber(draft.targetWeight) : null
  if (draft.targetWeight.trim() && (!(target > 0) || !Number.isFinite(target))) throw new Error('targetWeight')
  if (!PROFILE_GOALS.includes(draft.goal) || !EXPERIENCE_LEVELS.includes(draft.experience)) throw new Error('goal')
  const profile = normalizeProfile({ ...state.profile, name, avatarId: draft.avatarId, birthDate: draft.birthDate, sex: draft.sex, heightCm, goal: draft.goal, experience: draft.experience }, state.body)
  const changedWeight = draft.weight !== baseline.weight
  state.profile = { ...profile, startWeight: changedWeight ? weight : currentProfileWeight(state) }
  state.body = profile.sex
  if (draft.targetWeight !== baseline.targetWeight) state.targetW = target
  if (changedWeight) {
    const entries = Array.isArray(state.bodyweight) ? state.bodyweight : []
    const existing = entries.find(entry => entry.d === today)
    if (existing) { existing.w = weight; existing.t = now }
    else entries.push({ d: today, w: weight, t: now })
    state.bodyweight = entries.sort((a, b) => a.d.localeCompare(b.d))
  }
}
