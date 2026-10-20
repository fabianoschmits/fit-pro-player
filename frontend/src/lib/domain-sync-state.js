export const planFingerprint = state => JSON.stringify({ mode: state.planMode, week: state.week, dayPlan: state.dayPlan, routines: state.routines })

export const bodyFingerprint = state => JSON.stringify({ weights: state.bodyweight, measurements: state.bodyMeasurements })

export const preferenceValues = state => {
  const { routines, week, dayPlan, planMode, bodyweight, bodyMeasurements, workouts, active, exWeights,
    assignedProgram, pendingProfessionalEvents, professionalProgramDrafts, _ts, _pendingSync, ...values } = state
  return values
}

export const preferenceFingerprint = state => JSON.stringify(preferenceValues(state))

export function markPendingDomains(previous, next) {
  const pending = { ...previous._pendingSync, ...next._pendingSync }
  if (planFingerprint(previous) !== planFingerprint(next)) pending.plan = true
  if (bodyFingerprint(previous) !== bodyFingerprint(next)) pending.body = true
  if (preferenceFingerprint(previous) !== preferenceFingerprint(next)) pending.preferences = true
  next._pendingSync = pending
  return next
}
