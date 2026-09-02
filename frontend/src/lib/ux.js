// UX helpers — start labels, smart defaults, onboarding gates.
import { todayISO } from './format.js'
import { effectiveRoutine, defaultConfig, bestWeightFor } from './history.js'
import { t } from './i18n.js'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]

export function hasWeighedToday(S) {
  return (S.bodyweight || []).some(b => b.d === todayISO())
}

/** Whether the weigh-in sheet should open before a workout starts. */
export function shouldWeighBeforeWorkout(S) {
  return S.weighBeforeWorkout !== false && !hasWeighedToday(S)
}

/** Default exercise config seeded from the user's history. */
export function smartDefaultConfig(exId, S) {
  const cfg = defaultConfig(exId)
  const best = bestWeightFor(S, exId)
  const saved = (S.exWeights[exId] || {}).w
  const w = best || saved || 0
  if (w > 0 && !cfg.bodyweight) cfg.weight = w
  return cfg
}

/** Dynamic label for the centre tab-bar action. */
export function startTabLabel(S) {
  if (S.active) return t('Resume')
  if (!S.routines.length) return t('Set up plan')
  const r = effectiveRoutine(S, todayISO())
  if (r?.ex?.length) {
    const name = r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name
    return t('Train {0}', name)
  }
  if (r) return t('Add exercises')
  return t('Choose workout')
}

/** null when the weekly plan is fully set up. */
export function planSetupProgress(S) {
  if (!S.routines.length) return { step: 1, total: 3, label: t('Create routines') }
  if (!S.routines.some(r => r.ex.length > 0)) return { step: 2, total: 3, label: t('Add exercises') }
  const scheduled = WEEK_DAYS.filter(d => S.week[d] && S.routines.some(r => r.id === S.week[d])).length
  if (!scheduled) return { step: 3, total: 3, label: t('Schedule your week') }
  return null
}

export function needsOnboarding(S) {
  if (S.onboardingDone) return false
  if (S.routines.length || S.workouts.length || S.active) return false
  return true
}
