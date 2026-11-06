import legacyPrescriptions from './legacy-training-prescriptions.json'
import { isManagedPersonalizedRoutine, personalizedRoutineSpecs, prescriptionSignature } from './personalized-plan.js'
import { normalizePreferredWorkoutMinutes } from './profile.js'

// Frozen historical prescriptions provide positive provenance for accounts
// created before signatures were persisted. Only weight is user-progress data.
const withoutWeights = exercises => (exercises || []).map(({ weight: _weight, ...entry }) => entry)
const legacySignature = exercises => prescriptionSignature(withoutWeights(exercises))
const legacy = legacyPrescriptions.map(entry => ({ ...entry, signature: legacySignature(entry.ex) }))

export function automaticTemplateKey(routine) {
  if (!routine || routine.assigned || routine.starterCustomName) return null
  if (isManagedPersonalizedRoutine(routine) && routine.personalizedKey) return routine.personalizedKey
  const signature = legacySignature(routine.ex)
  const match = legacy.find(entry => entry.signature === signature && (
    entry.kind === 'personalized'
      ? routine.planGenerated === true && routine.personalizedKey === entry.key
      : !routine.planGenerated && routine.starterKey === entry.starterKey
  ))
  if (!match) return null
  return match.key || ({ 'Chest Day': 'chest', 'Back Day': 'back', 'Leg Day': 'legs', 'Abs Day': 'abs',
    'Arms Day': 'arms', 'Shoulders Day': 'shoulders', 'Glutes Day': 'glutes' })[match.starterKey] || null
}

/** One-time upgrade of positively identified automatic prescriptions only. */
export function upgradeAutomaticPlans(state) {
  if (!Array.isArray(state.routines)) return state
  const targetMinutes = normalizePreferredWorkoutMinutes(state.profile?.preferredWorkoutMinutes)
  const scheduledDays = new Set(Object.values(state.week || {}).filter(Boolean)).size
  const managedCount = state.routines.filter(routine => automaticTemplateKey(routine)).length
  const dayCount = state.planMode === 'daily' ? 7 : Math.max(1, Math.min(7, scheduledDays || managedCount || 3))
  state.routines = state.routines.map(routine => {
    if (routine.id === state.active?.routineId) return routine
    const key = automaticTemplateKey(routine)
    if (!key || (routine.planTemplateVersion === 2 && routine.planTargetMinutes === targetMinutes)) return routine
    const profile = { ...state.profile, goal: state.profile?.goal || routine.planGoal, experience: state.profile?.experience || routine.planExperience,
      preferredWorkoutMinutes: targetMinutes }
    const [spec] = personalizedRoutineSpecs(profile, dayCount, { daily: state.planMode === 'daily', state, keys: [key] })
    if (!spec || spec.personalizedKey !== key) return routine
    const weights = new Map()
    for (const entry of routine.ex || []) {
      const occurrences = weights.get(entry.id) || []
      occurrences.push(Object.hasOwn(entry, 'weight') ? entry.weight : undefined)
      weights.set(entry.id, occurrences)
    }
    const consumed = new Map()
    const ex = spec.ex.map(entry => {
      const occurrence = consumed.get(entry.id) || 0
      consumed.set(entry.id, occurrence + 1)
      const weight = weights.get(entry.id)?.[occurrence]
      return weight === undefined ? entry : { ...entry, weight }
    })
    return { ...routine, ...spec, id: routine.id, name: spec.starterKey, ex,
      planSignature: prescriptionSignature(ex) }
  })
  return state
}
