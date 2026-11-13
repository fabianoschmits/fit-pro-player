import { todayISO } from './format.js'
import { fromDisplayMass, toDisplayMass } from './mass.js'
import { applyPersonalizedPlan } from './personalized-plan.js'
import {
  currentProfileWeight, decimalNumber, EXPERIENCE_LEVELS, formatPersonName, heightCmFromText,
  heightText, isValidWorkoutMinutes, PROFILE_GOALS, weightText,
} from './profile.js'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]
const STRING_FIELDS = ['name', 'avatarId', 'birthDate', 'sex', 'height', 'startWeight', 'targetWeight', 'goal', 'experience', 'intention', 'unit', 'planMode']
const clone = value => JSON.parse(JSON.stringify(value))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

/** Identify the active cache, refusing an auth/cache mismatch during account changes. */
export function onboardingOwner(store, user = undefined) {
  const scope = store.getState().getActiveLocalScope?.()
  if (!scope) return user?.id ? `account:${user.id}` : 'anonymous'
  if (user === null && scope.kind === 'account') return null
  if (user?.id && (scope.kind !== 'account' || scope.userId !== user.id)) return null
  return scope.kind === 'account' ? `account:${scope.userId}` : 'anonymous'
}

/** New personal data remains unset until it is supplied; DEFAULT_PROFILE's body is not consent. */
export function createTrainingDraft(state, user = undefined) {
  const profile = state.profile || {}
  const unit = state.displayUnit === 'lb' ? 'lb' : 'kg'
  const scheduled = WEEK_DAYS.filter(day => state.week?.[day] && state.routines?.some(routine => routine.id === state.week[day]))
  return {
    version: 1,
    kind: 'training',
    step: 0,
    values: {
      name: formatPersonName(profile.name || user?.displayName || ''),
      intention: '',
      avatarId: profile.avatarId || '',
      birthDate: profile.birthDate || '',
      sex: profile.completedAt ? profile.sex || '' : '',
      height: heightText(profile.heightCm),
      startWeight: weightText(toDisplayMass(currentProfileWeight(state), unit)),
      targetWeight: weightText(toDisplayMass(state.targetW, unit)),
      goal: profile.goal || '',
      experience: profile.experience || '',
      preferredWorkoutMinutes: profile.preferredWorkoutMinutes || 60,
      unit,
      planMode: state.planMode === 'daily' ? 'daily' : 'weekly',
    },
    days: scheduled.length ? scheduled : [1, 3, 5],
  }
}

function cleanDraft(draft, owner) {
  const values = Object.fromEntries(STRING_FIELDS.map(key => [key, typeof draft.values?.[key] === 'string' ? draft.values[key].slice(0, 120) : '']))
  values.name = formatPersonName(values.name).trim()
  values.unit = values.unit === 'lb' ? 'lb' : 'kg'
  values.planMode = values.planMode === 'daily' ? 'daily' : 'weekly'
  values.preferredWorkoutMinutes = typeof draft.values?.preferredWorkoutMinutes === 'number' && Number.isFinite(draft.values.preferredWorkoutMinutes) ? draft.values.preferredWorkoutMinutes : ''
  return {
    version: 1, kind: 'training', owner,
    step: Math.max(0, Math.min(3, Number.isInteger(draft.step) ? draft.step : 0)),
    values,
    days: WEEK_DAYS.filter(day => Array.isArray(draft.days) && draft.days.includes(day)),
  }
}

export function readTrainingDraft(state, owner) {
  const draft = state.onboardingDraft
  if (!owner || draft?.version !== 1 || draft.kind !== 'training' || draft.owner !== owner || !draft.values) return null
  return cleanDraft(draft, owner)
}

function assertOwner(store, owner, token = undefined) {
  if (!owner || onboardingOwner(store) !== owner || (token && store.getState().isScopeCurrent?.(token) === false)) {
    throw new Error('onboarding-account-changed')
  }
}

/** update() writes the scoped cache; flush also awaits the native file mirror. */
async function persistChange(store, owner, mutate) {
  assertOwner(store, owner)
  const token = store.getState().getScopeToken?.()
  const before = clone(store.getState().S)
  let changedKeys = []
  let written = null
  try {
    store.getState().update(state => {
      mutate(state)
      changedKeys = [...new Set([...Object.keys(before), ...Object.keys(state)])].filter(key => !same(before[key], state[key]))
    })
    // Include ids assigned by persistence, but exclude timestamps and sync metadata it owns.
    written = clone(store.getState().S)
    if (store.getState().persistence?.state === 'error') throw new Error('onboarding-storage-failed')
    const flushed = await store.getState().flushPersistence?.()
    assertOwner(store, owner, token)
    if (flushed === false || store.getState().persistence?.state === 'error') throw new Error('onboarding-storage-failed')
  } catch (error) {
    // Roll back only this operation's untouched fields; preserve updates received while flushing.
    // A different account or a newer write must never receive this operation's old snapshot.
    if (onboardingOwner(store) === owner && (!token || store.getState().isScopeCurrent?.(token) !== false)) {
      if (written) store.getState().update(state => {
        changedKeys.forEach(key => {
          if (!same(state[key], written[key])) return
          if (Object.hasOwn(before, key)) state[key] = clone(before[key])
          else delete state[key]
        })
      })
      store.setState({ persistence: { state: 'error', error: 'onboarding-storage-failed' } })
    }
    throw error
  }
}

/** Draft saves intentionally leave the profile, generated routines and schedule untouched. */
export async function saveTrainingDraft(store, owner, draft) {
  const clean = cleanDraft(draft, owner)
  await persistChange(store, owner, state => { state.onboardingDraft = clean })
  return clean
}

function validateCompletion(draft) {
  const values = draft.values
  if (values.name.trim().length < 2) throw new Error('onboarding-name-required')
  if (!['self', 'professional'].includes(values.intention)) throw new Error('onboarding-intention-required')
  if (values.intention === 'professional') return
  if (!PROFILE_GOALS.includes(values.goal) || !EXPERIENCE_LEVELS.includes(values.experience)) throw new Error('onboarding-training-profile-required')
  if (!decimalNumber(values.startWeight)) throw new Error('onboarding-weight-required')
  if (!isValidWorkoutMinutes(values.preferredWorkoutMinutes)) throw new Error('onboarding-duration-invalid')
  if (values.planMode === 'weekly' && !draft.days.length) throw new Error('onboarding-days-required')
  if (values.height && (heightCmFromText(values.height) < 100 || heightCmFromText(values.height) > 250 || !heightCmFromText(values.height))) throw new Error('onboarding-height-invalid')
  if (values.targetWeight && !decimalNumber(values.targetWeight)) throw new Error('onboarding-weight-required')
  if (values.birthDate) {
    const date = new Date(`${values.birthDate}T12:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== values.birthDate || values.birthDate < '1900-01-01' || values.birthDate > todayISO()) throw new Error('onboarding-birth-invalid')
  }
}

/** Complete once. A failed write restores the incomplete draft and original personal plan. */
export async function completeTrainingOnboarding(store, owner, draft) {
  assertOwner(store, owner)
  const clean = cleanDraft(draft, owner)
  validateCompletion(clean)
  const values = clean.values
  const destination = values.intention === 'professional' ? '/student/professionals/add' : '/plan'
  if (store.getState().S.onboardingDone) return destination
  await persistChange(store, owner, state => {
    state.profile = { ...state.profile, name: values.name, completedAt: Date.now() }
    if (values.intention === 'self') {
      const startWeight = fromDisplayMass(decimalNumber(values.startWeight), values.unit)
      state.profile = {
        ...state.profile, avatarId: values.avatarId || state.profile.avatarId,
        birthDate: values.birthDate, heightCm: heightCmFromText(values.height), startWeight,
        goal: values.goal, experience: values.experience, preferredWorkoutMinutes: values.preferredWorkoutMinutes,
        ...(values.sex === 'male' || values.sex === 'female' ? { sex: values.sex } : {}),
      }
      if (values.sex === 'male' || values.sex === 'female') state.body = values.sex
      state.displayUnit = values.unit
      state.targetW = fromDisplayMass(decimalNumber(values.targetWeight), values.unit)
      state.planMode = values.planMode
      const today = todayISO()
      const existing = state.bodyweight.find(entry => entry.d === today)
      if (existing) { existing.w = startWeight; existing.t = Date.now() }
      else state.bodyweight.push({ d: today, w: startWeight, t: Date.now() })
      state.bodyweight.sort((a, b) => a.d.localeCompare(b.d))
      const daily = values.planMode === 'daily'
      const routines = applyPersonalizedPlan(state, state.profile, daily ? 7 : clean.days.length, { daily })
      if (daily) state.dayPlan[today] = routines[0].id
      else state.week = Object.fromEntries(clean.days.map((day, index) => [day, routines[index % routines.length].id]))
    }
    state.onboardingVersion = 1
    state.onboardingDone = true
    state.onboardingDraft = null
  })
  return destination
}
